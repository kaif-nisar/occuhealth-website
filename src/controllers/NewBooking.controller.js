import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js";
import { newBooking } from "../models/NewBooking.model.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { testSchema } from "../models/newTest.model.js";
import { User } from "../models/user.model.js";
import { addPannel } from "../models/AddPannel.model.js";
import { Package } from "../models/addPackage.model.js";
import { Ledger } from "../models/ledger.model.js";
import { acceptedBarcode } from "../models/samples.model.js";
import mongoose from "mongoose";
import { Conversation } from "../models/message.model.js";
import { bookedTestsresult } from "../models/Testvalues.model.js";
import { lisdata } from "../models/lismodel.js";
import { Target } from "../models/target.model.js";
import { Counter, categorydb } from "../models/category.model.js";
import { customization } from "../models/printsetting.model.js";

const BOOKING_LIST_PROJECTION = "bookingId date time patientName patientPhone gender doctorName labName franchisee status total createdAt updatedAt createdBy createdbyuser tableData.testName tableData.barcodeId savedDoctor savedLab isreportready";
const LAB_REPORT_TEST_SELECT = "order Name Short_name category parameters sampleType method instrument interpretation isDocumentedTest";
const LAB_REPORT_PANEL_SELECT = "order name category testsId interpretation sample_types hideInterpretation hideMethodInstrument";
const BOOKING_ATTACHMENT_FORMAT = "bookingAttachments";

const normalizeBookingAttachment = (attachment = {}) => ({
    url: String(attachment.url || "").trim(),
    publicId: String(attachment.publicId || "").trim(),
    fileType: String(attachment.fileType || "image").toLowerCase(),
    fileName: attachment.fileName || "attachment",
    resourceType: String(attachment.resourceType || (attachment.fileType === "pdf" ? "raw" : "image")).toLowerCase(),
    mimeType: attachment.mimeType || "",
    fileExtension: String(attachment.fileExtension || "").toLowerCase(),
    order: Number(attachment.order || 0),
    uploadedAt: attachment.uploadedAt || new Date(),
});

const sortAttachmentDocs = (docs = []) => {
    return [...docs].sort((left, right) => {
        const leftHasAttachments = Array.isArray(left?.attachments) && left.attachments.length > 0 ? 1 : 0;
        const rightHasAttachments = Array.isArray(right?.attachments) && right.attachments.length > 0 ? 1 : 0;

        if (leftHasAttachments !== rightHasAttachments) {
            return rightHasAttachments - leftHasAttachments;
        }

        const leftFormatMatch = String(left?.format || "") === BOOKING_ATTACHMENT_FORMAT ? 1 : 0;
        const rightFormatMatch = String(right?.format || "") === BOOKING_ATTACHMENT_FORMAT ? 1 : 0;

        if (leftFormatMatch !== rightFormatMatch) {
            return rightFormatMatch - leftFormatMatch;
        }

        const leftTime = new Date(left?.updatedAt || left?.createdAt || 0).getTime();
        const rightTime = new Date(right?.updatedAt || right?.createdAt || 0).getTime();
        return rightTime - leftTime;
    });
};

async function attachBookingAttachments(bookings, tenantId) {
    if (!bookings.length) {
        return bookings;
    }

    const bookingIds = bookings.map((booking) => booking.bookingId);
    const attachmentDocs = await customization.find(
        {
            tenantId,
            bookingId: { $in: bookingIds },
        },
        {
            bookingId: 1,
            attachments: 1,
            format: 1,
            updatedAt: 1,
            createdAt: 1,
        }
    ).lean();

    const attachmentMap = new Map();
    const groupedDocs = new Map();

    attachmentDocs.forEach((doc) => {
        const bookingKey = String(doc?.bookingId || "").trim();
        if (!bookingKey) {
            return;
        }

        if (!groupedDocs.has(bookingKey)) {
            groupedDocs.set(bookingKey, []);
        }

        groupedDocs.get(bookingKey).push(doc);
    });

    groupedDocs.forEach((docs, bookingIdKey) => {
        const sortedDocs = sortAttachmentDocs(docs);
        const selectedDoc = sortedDocs.find((doc) => Array.isArray(doc?.attachments) && doc.attachments.length > 0);

        attachmentMap.set(
            bookingIdKey,
            (selectedDoc?.attachments || []).map(normalizeBookingAttachment)
        );
    });

    return bookings.map((booking) => ({
        ...booking,
        attachments: attachmentMap.get(String(booking.bookingId || "").trim()) || [],
    }));
}

const findbookingId = async (req, res) => {
    const randomId = req.query.randomId;
    const exists = Boolean(await newBooking.exists({
        tenantId: req.user?.tenantId?._id,
        bookingId: randomId
    }));

    return res.status(200).json({ exists });
}

const NewBookingcontroller = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            barcodeId, date, time, courierName, courierId, patientName,
            year, gender, patientPhone, doctorName, labName, franchisee,
            clinicalHistory, subFranchisee, savedDoctor, userId,
            savedLab, subFranchiseeId, savedDoctorId, savedLabId, total, tableData, testIds,
            createdbyuser, discountamount, discountunit
        } = req.body;

        console.log(req.body);

        const tenantId = req.user.tenantId;
        let user;
        if (req.user.role === "staff") {
            user = req.user.parentUser;
        } else {
            user = req.user._id;
        }

        // Clean up optional IDs
        const cleanSubFranchiseeId = (!subFranchiseeId ||
            subFranchiseeId.trim() === '' ||
            subFranchiseeId === "null" ||
            subFranchiseeId === "undefined") ? undefined : subFranchiseeId;

        const cleanSavedDoctorId = (!savedDoctorId ||
            savedDoctorId === "null" ||
            savedDoctorId === "undefined") ? undefined : savedDoctorId;

        const cleanSavedLabId = (!savedLabId ||
            savedLabId === "null" ||
            savedLabId === "undefined") ? undefined : savedLabId;

        const issinglelayeradmin = tenantId.modelType === "1layer" &&
            (req.user.role === "admin" || (req.user.role === "staff" && req.user.parentRole === "admin"));

        const parsedTotal = Number(total);

        // Parse tableData
        let tableData2 = tableData;
        if (typeof tableData === "string") {
            tableData2 = JSON.parse(tableData);
        }

        if (!Array.isArray(tableData2)) {
            console.error("Error: tableData is not an array", tableData);
            return res.status(500).json({ error: "Invalid data format" });
        }

        // Check for duplicate barcodes
        for (const element of tableData2) {
            console.log("This is an element:", element);

            const isBarcodeIdPresent = await newBooking.findOne({
                'tableData.barcodeId': element.confirmBarcodeId
            }).session(session);

            if (isBarcodeIdPresent) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: `${element.confirmBarcodeId} barcode already present` });
            }
        }

        // Validate required fields
        if (!patientName) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Patient Name is required" });
        }

        // Check if booking already exists
        const existingBooking = await newBooking.findOne({
            tenantId: tenantId._id,
            bookingId: barcodeId
        }).session(session);

        if (existingBooking) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Booking already exists' });
        }

        // Handle uploaded files
        let fileLink = null;
        if (req.files?.file?.length > 0) {
            const uploadableFilepath = req.files.file[0].path;
            fileLink = await uploadOnCloudinary(uploadableFilepath);
        }

        // Parse tableData and testIds
        let parsedTableData, parsedSelectedTestIds;
        try {
            parsedTableData = typeof tableData === "string" ? JSON.parse(tableData) : tableData;
            parsedSelectedTestIds = typeof testIds === "string" ? JSON.parse(testIds) : testIds;
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw new ApiError(400, "Invalid JSON format for tableData or testIds");
        }

        if (!Array.isArray(parsedSelectedTestIds)) {
            parsedSelectedTestIds = [];
        }

        // Fallback: if no explicit testIds were sent, derive them from tableData entries
        if (parsedSelectedTestIds.length === 0 && Array.isArray(parsedTableData)) {
            parsedSelectedTestIds = parsedTableData.flatMap(entry => {
                if (!Array.isArray(entry.ids)) return [];
                return entry.ids
                    .map(idInfo => idInfo && (idInfo.id || idInfo._id))
                    .filter(Boolean);
            });
        }

        // Normalize IDs and remove duplicates
        parsedSelectedTestIds = Array.from(new Set(parsedSelectedTestIds.map(id => id.toString())));
        console.log(`   Derived selected tests count: ${parsedSelectedTestIds.length}`, parsedSelectedTestIds);

        // Extract sampleBarcodeId from parsedTableData
        const sampleBarcodeId = parsedTableData.map(entry => entry.confirmBarcodeId).filter(id => id != null);

        if (sampleBarcodeId.length === 0) {
            await session.abortTransaction();
            session.endSession();
            throw new ApiError(400, "Sample Barcode IDs are missing in tableData");
        }

        const transactionId = `#CR${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // ============================================================
        // Non-admin users: Handle wallet and commission
        // ============================================================
        if (req.user.role !== "admin" && !(req.user.role === "staff" && req.user.parentRole === "admin")) {
            const bookingUser = await User.findById(userId).session(session);
            if (!bookingUser) {
                await session.abortTransaction();
                session.endSession();
                throw new ApiError(404, "Booking user not found");
            }

            // Validate wallet balance
            const balanceAfterTransaction = bookingUser.bookingWallet - parsedTotal;
            if (balanceAfterTransaction < 0) {
                const overdraftAllowed = !!bookingUser.overdraftAllowed;
                const overdraftLimit = Number(bookingUser.overdraftLimit || 0);
                const overdraftNeeded = Math.abs(balanceAfterTransaction);

                if (!overdraftAllowed || overdraftNeeded > overdraftLimit) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(402).json({ message: 'Insufficient Balance, recharge wallet' });
                }
            }

            let totalCommission = 0;
            const testDetailsForCurrentUser = [];
            const parentUserCache = new Map();

            // ============================================================
            // Calculate commissions — FIXED
            // ============================================================
            for (const item of parsedSelectedTestIds) {
                console.log(`\n📦 Processing test/package ID: ${item}`);

                // ✅ FIX: session properly pass kiya har query mein
                const testOrPackage =
                    await testSchema.findById(item).session(session) ||
                    await addPannel.findById(item).session(session) ||
                    await Package.findById(item).session(session);

                if (!testOrPackage) {
                    console.error(`❌ Test/Package not found for ID: ${item}`);
                    await session.abortTransaction();
                    session.endSession();
                    throw new ApiError(404, `Test/Package with ID ${item} not found`);
                }

                console.log(`   Test name: ${testOrPackage.Name || testOrPackage.name || testOrPackage.packageName}`);

                const assignedPrices = testOrPackage.assignedPrices;
                console.log(`   Total assignedPrices entries: ${assignedPrices?.length || 0}`);
                console.log(`   assignedPrices:`, JSON.stringify(assignedPrices));

                let currentPrice = assignedPrices?.find(price =>
                    price.userId.toString() === bookingUser._id.toString()
                )?.price;

                if (currentPrice === undefined || currentPrice === null) {
                    console.error(`❌ BOOKING FAILED — No assignedPrice for booking user: ${bookingUser.username} (ID: ${bookingUser._id})`);
                    console.error(`   Reason: This user's ID is missing in the test's assignedPrices array.`);
                    console.error(`   Fix: Admin should assign a price for this user in test/package settings.`);
                    await session.abortTransaction();
                    session.endSession();
                    throw new ApiError(403, `No assigned price found for user ${bookingUser.username} on this test/package`);
                }

                console.log(`   Booking user (${bookingUser.username}) price: ₹${currentPrice}`);

                testDetailsForCurrentUser.push({
                    testName: testOrPackage.name || testOrPackage.packageName || testOrPackage.Name,
                    testPrice: currentPrice,
                });

                let parentId = bookingUser.createdBy || bookingUser.parentUser;
                const startingParentId = parentId;
                let childUsername = bookingUser.username;
                let parentChainSteps = 0;

                console.log(`   Commission chain start for booking user ${bookingUser.username}: parentId=${parentId}`);

                if (!parentId) {
                    console.warn(`⚠️ Booking user ${bookingUser.username} has no createdBy or parentUser set — no commission chain exists.`);
                }

                // ============================================================
                // Commission distribution loop — FIXED
                // ============================================================
                while (parentId) {
                    parentChainSteps += 1;
                    // ✅ FIX: toString() ensure kiya cache key ke liye
                    let parentUser = parentUserCache.get(parentId.toString());
                    if (!parentUser) {
                        parentUser = await User.findById(parentId).session(session);
                        if (!parentUser) {
                            console.warn(`⚠️ Parent user not found in DB for ID: ${parentId}. Commission chain broken here.`);
                            break;
                        }
                        parentUserCache.set(parentId.toString(), parentUser);
                    }

                    console.log(`\n🔁 Checking commission for: ${parentUser.username} (Role: ${parentUser.role})`);
                    console.log(`   Child price being used (currentPrice): ₹${currentPrice}`);

                    const parentPrice = assignedPrices.find(price =>
                        price.userId.toString() === parentUser._id.toString()
                    )?.price;

                    if (parentPrice === undefined || parentPrice === null) {
                        console.warn(`⚠️ COMMISSION SKIPPED — No assignedPrice for: ${parentUser.username} (ID: ${parentUser._id})`);
                        console.warn(`   Reason: This user's ID is not present in assignedPrices of this test/package.`);
                        console.warn(`   Fix: Admin should assign a price for this user.`);
                        parentId = parentUser.createdBy || parentUser.parentUser;
                        continue;
                    }

                    console.log(`   ${parentUser.username}'s assignedPrice: ₹${parentPrice}`);
                    const commissionForParent = currentPrice - parentPrice;
                    console.log(`   Commission = currentPrice(₹${currentPrice}) - parentPrice(₹${parentPrice}) = ₹${commissionForParent}`);

                    if (commissionForParent < 0) {
                        console.warn(`⚠️ COMMISSION SKIPPED — Negative commission for ${parentUser.username}`);
                        console.warn(`   Reason: parentPrice(₹${parentPrice}) > currentPrice(₹${currentPrice}). Price structure galat hai.`);
                        console.warn(`   Fix: Parent ka assigned price child se hamesha kam ya barabar hona chahiye.`);
                        parentId = parentUser.createdBy || parentUser.parentUser;
                        childUsername = parentUser.username;
                        currentPrice = parentPrice;
                        continue;
                    }

                    if (commissionForParent === 0) {
                        console.warn(`⚠️ COMMISSION SKIPPED — Zero commission for ${parentUser.username}`);
                        console.warn(`   Reason: Parent aur child ka price same hai (₹${currentPrice}). Koi margin nahi.`);
                        parentId = parentUser.createdBy || parentUser.parentUser;
                        childUsername = parentUser.username;
                        currentPrice = parentPrice;
                        continue;
                    }

                    // ✅ Valid commission — process karo
                    totalCommission += commissionForParent;

                    const parentLedgerEntry = new Ledger({
                        userId: parentUser._id,
                        username: parentUser.username,
                        amount: commissionForParent,
                        type: "credit",
                        transactionId,
                        description: `${barcodeId}`,
                        balanceAfterTransaction: parentUser.bookingWallet + commissionForParent,
                        receivedFrom: childUsername,
                        myAmount: currentPrice,
                        testDetails: [{
                            testName: testOrPackage.name || testOrPackage.packageName || testOrPackage.Name,
                            testPrice: currentPrice,
                            commissionAmount: commissionForParent,
                        }],
                        patientName: patientName,
                        barcodeId: sampleBarcodeId,
                        discountamount: issinglelayeradmin ? Number(discountamount) : 0,
                        discountunit: issinglelayeradmin ? Number(discountunit) : 0,
                    });

                    await parentLedgerEntry.save({ session });
                    parentUser.bookingWallet += commissionForParent;
                    await parentUser.save({ session });

                        console.log(`✅ Commission credited to ${parentUser.username}: ₹${commissionForParent} | New wallet: ₹${parentUser.bookingWallet}`);

                    // ✅ FIX: Sirf tab update karo jab commission successfully process hua ho
                    parentId = parentUser.createdBy || parentUser.parentUser;
                    childUsername = parentUser.username;
                    currentPrice = parentPrice;
                }

                console.log(`\n📊 Commission distributed for this test — Total so far: ₹${totalCommission}`);
                console.log(`   Commission chain end for booking user ${bookingUser.username}: startingParentId=${startingParentId}, steps=${parentChainSteps}`);
            }

            // Create ledger entry for booking user (debit)
            const bookingLedgerEntry = new Ledger({
                userId: bookingUser._id,
                username: bookingUser.username,
                amount: parsedTotal,
                patientName: patientName,
                sampleBarcodeId: sampleBarcodeId,
                type: "debit",
                transactionId,
                description: `Booking for ${barcodeId}`,
                balanceAfterTransaction,
                testDetails: testDetailsForCurrentUser,
                discountamount: issinglelayeradmin ? Number(discountamount) : 0,
                discountunit: issinglelayeradmin ? Number(discountunit) : 0,
            });

            await bookingLedgerEntry.save({ session });

            bookingUser.bookingWallet = balanceAfterTransaction;
            await bookingUser.save({ session });
            console.log(`💳 Booking user ${bookingUser.username} wallet debited. New balance: ₹${balanceAfterTransaction}`);
        }

        // ============================================================
        // Create booking object
        // ============================================================
        const object = {
            bookingId: barcodeId,
            date,
            time,
            courierName,
            courierId,
            patientName,
            year,
            gender,
            patientPhone,
            doctorName,
            labName,
            franchisee,
            clinicalHistory,
            file: fileLink?.url || "",
            tableData: parsedTableData.map(entry => ({
                ...entry,
                barcodeId: entry.confirmBarcodeId || entry.barcodeId,
            })),
            total: parsedTotal,
            subFranchisee: subFranchisee || "",
            subFranchiseeId: cleanSubFranchiseeId,
            savedDoctor: savedDoctor || "",
            savedDoctorId: cleanSavedDoctorId,
            savedLab: savedLab || "",
            savedLabId: cleanSavedLabId,
            discountamount: issinglelayeradmin ? Number(discountamount) : 0,
            discountunit: issinglelayeradmin ? Number(discountunit) : 0,
            createdBy: userId,
            tenantId: tenantId._id,
            createdbyuser: createdbyuser
        };

        // ============================================================
        // Admin/staff booking creation
        // ============================================================
        if (req.user.role === "admin" || (req.user.role === 'staff' && req.user.parentRole === "admin")) {
            const bookingUser = await User.findById(user).session(session);
            if (!bookingUser) {
                await session.abortTransaction();
                session.endSession();
                throw new ApiError(404, "Booking user not found");
            }

            const bookingLedgerEntry = new Ledger({
                userId: bookingUser._id,
                username: bookingUser.username,
                amount: parsedTotal,
                patientName: patientName,
                sampleBarcodeId: sampleBarcodeId,
                type: "debit",
                transactionId,
                description: `Booking for ${barcodeId}`,
                discountamount: issinglelayeradmin ? Number(discountamount) : 0,
                discountunit: issinglelayeradmin ? Number(discountunit) : 0,
            });

            await bookingLedgerEntry.save({ session });

            const processedPackages = new Set();

            for (const element of parsedTableData) {
                const existingBarcode = await acceptedBarcode.findOne({
                    tenantId: tenantId._id,
                    "barcodes.barcode": element.confirmBarcodeId,
                }).session(session);

                if (existingBarcode) {
                    console.log("booking already present");
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: "This barcode is already accepted." });
                }

                const savedbarcode = await acceptedBarcode.findOne({
                    tenantId: tenantId._id,
                    bookingId: barcodeId
                }).session(session);

                const testResults = await Promise.all(
                    element.ids.map(async obj => {
                        if (obj.collectionName === "testSchema") {
                            const doc = await testSchema.findById(obj.id).select('Name').session(session);
                            return doc ? { names: [doc.Name], objects: [obj] } : { names: [], objects: [] };
                        }

                        if (obj.collectionName === "addPannel") {
                            const doc = await addPannel.findById(obj.id).select('name').session(session);
                            return doc ? { names: [doc.name], objects: [obj] } : { names: [], objects: [] };
                        }

                        if (obj.collectionName === "Package") {
                            const packageKey = `${obj.id}_${element.typeOfSample}`;
                            if (processedPackages.has(packageKey)) {
                                return { names: [], objects: [] };
                            }
                            processedPackages.add(packageKey);

                            const doc = await Package.findById(obj.id)
                                .select('testIds pannelIds')
                                .populate('testIds pannelIds')
                                .session(session);

                            console.log("packages :", doc);
                            if (!doc) return { names: [], objects: [] };

                            const packagetestNames = [];
                            const packagetestObjects = [];
                            const packagepanelNames = [];
                            const packagepanelObjects = [];

                            const addedTestIds = new Set();
                            const addedPanelIds = new Set();

                            doc.testIds.forEach(test => {
                                if (test.sampleType === element.typeOfSample && !addedTestIds.has(test._id.toString())) {
                                    packagetestNames.push(test.Name);
                                    packagetestObjects.push({ id: test._id, collectionName: "testSchema" });
                                    addedTestIds.add(test._id.toString());
                                }
                            });

                            doc.pannelIds.forEach(panel => {
                                if (panel.sample_types[0] === element.typeOfSample && !addedPanelIds.has(panel._id.toString())) {
                                    packagepanelNames.push(panel.name);
                                    packagepanelObjects.push({ id: panel._id, collectionName: "addPannel" });
                                    addedPanelIds.add(panel._id.toString());
                                }
                            });

                            return {
                                names: [...packagetestNames, ...packagepanelNames],
                                objects: [...packagetestObjects, ...packagepanelObjects]
                            };
                        }
                        return { names: [], objects: [] };
                    })
                );

                const allNames = testResults.flatMap(r => r.names);
                const allObjects = testResults.flatMap(r => r.objects);

                const testnames = [...new Set(allNames)];
                const testObjectsMap = new Map();
                allObjects.forEach(obj => {
                    const key = `${obj.id}_${obj.collectionName}`;
                    if (!testObjectsMap.has(key)) {
                        testObjectsMap.set(key, obj);
                    }
                });
                const testObjects = Array.from(testObjectsMap.values());

                if (savedbarcode) {
                    await acceptedBarcode.updateOne(
                        { bookingId: barcodeId },
                        {
                            $addToSet: {
                                barcodes: {
                                    barcode: element.confirmBarcodeId,
                                    testandpannelArray: testnames,
                                    sampleType: element.typeOfSample,
                                    testIds: testObjects
                                }
                            }
                        },
                        { session }
                    );
                } else {
                    const newBarcodeDocument = new acceptedBarcode({
                        tenantId: tenantId._id,
                        bookingId: barcodeId,
                        barcodes: [{
                            barcode: element.confirmBarcodeId,
                            testandpannelArray: testnames,
                            sampleType: element.typeOfSample,
                            testIds: testObjects
                        }],
                    });

                    await newBarcodeDocument.save({ session });
                }
            }

            object.status = "pending";
        }

        // ============================================================
        // Create booking
        // ============================================================
        const createdBooking = await newBooking.create([object], { session });

        if (!createdBooking || createdBooking.length === 0) {
            await session.abortTransaction();
            session.endSession();
            throw new ApiError(500, "Failed to create booking");
        }

        const booking = createdBooking[0];

        // Staff activity tracking
        if (req.user.role === 'staff') {
            await User.findByIdAndUpdate(
                req.user._id,
                {
                    $push: {
                        activities: {
                            activityType: "booking",
                            details: {
                                staffId: req.user._id,
                                staffName: req.user.fullName,
                                action: `${req.user.fullName} created a new Booking`,
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

        // Update ledger with caseId
        const savedcaseid = await Ledger.updateMany(
            { transactionId },
            { $set: { caseId: booking._id } },
            { session }
        );

        if (!savedcaseid) {
            await session.abortTransaction();
            session.endSession();
            throw new ApiError(500, "Failed to update ledger with caseId");
        }

        // Update target achievement
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (req.user.role !== "admin" && !(req.user.role === "staff" && req.user.parentRole === "admin")) {
            const currentTarget = await Target.findOne({
                franchiseeId: user,
                month: currentMonth,
                tenantId: tenantId._id
            }).session(session);

            if (currentTarget) {
                await currentTarget.updateAchieved(parsedTotal, booking._id);
            } else {
                await Target.create([{
                    franchiseeId: user,
                    fullName: req.user.fullName,
                    assignedBy: req.user._id,
                    month: currentMonth,
                    amount: 0,
                    achieved: parsedTotal,
                    tenantId: tenantId._id,
                    history: [{
                        amount: parsedTotal,
                        bookingId: booking._id,
                        description: 'Booking completed (No target set)'
                    }]
                }], { session });
            }
        }

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        res.status(201).json(new ApiResponse(200, booking, "Test booked successfully and commissions distributed"));

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error("Transaction failed:", err);
        throw err;
    }
});

/**
 * बल्क बुकिंग को प्रोसेस करने वाला कंट्रोलर
 * यह फ्रंटएंड से मिले JSON ऐरे को प्रोसेस करके डेटाबेस में बुकिंग्स बनाता है।
 */
const bulkBookingsController = asyncHandler(async (req, res) => {
    const bookingsData = req.body;
    const tenantId = req.user.tenantId._id;
    const createdBy = req.user._id;
    const createdbyuser = req.user.username;

    if (!Array.isArray(bookingsData) || bookingsData.length === 0) {
        throw new ApiError(400, "No booking data found to process.");
    }

    const successfulBookings = [];
    const failedBookings = [];

    for (const booking of bookingsData) {
        try {
            // रोगी का नाम कैपिटलाइज़ करना (Capitalize Patient Name)
            const capitalizedName = String(booking.PatientName || booking.patientName || "").toUpperCase();

            const bookingObj = {
                bookingId: booking.barcodeId || "OH" + Math.floor(Math.random() * 10000000000),
                date: booking.date || new Date().toISOString().split('T')[0],
                time: booking.time || new Date().toTimeString().split(' ')[0].substring(0, 5),
                patientName: capitalizedName,
                year: booking.year || "",
                gender: booking.gender || "Any",
                patientPhone: booking.patientPhone || "",
                doctorName: booking.doctorName || "",
                labName: booking.labName || "",
                clinicalHistory: booking.clinicalHistory || "",
                total: Number(booking.total || 0),
                bulkUploadedResults: booking.bulkUploadedResults || [],
                tableData: booking.tableData || [],
                tenantId,
                createdBy,
                createdbyuser,
                status: "pending"
            };

            const created = await newBooking.create([bookingObj]);
            successfulBookings.push({ bookingId: created[0].bookingId, patientName: capitalizedName });
        } catch (error) {
            failedBookings.push({ 
                patient: booking.PatientName || booking.patientName || "Unknown", 
                error: error.message 
            });
        }
    }

    return res.status(200).json(
        new ApiResponse(200, { successfulBookings, failedBookings }, "Bulk booking process completed.")
    );
});

const cancelBookingController = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession(); // Start a session for the transaction
    session.startTransaction(); // Start the transaction

    try {
        const { bookingId } = req.body; // bookingId to cancel
        const tenantId = req.user.tenantId;

        let user;
        if (req.user.role === "staff") {
            user = req.user.parentUser
        } else {
            user = req.user._id
        }

        let issinglelayeradmin = false;
        issinglelayeradmin = tenantId.modelType === "1layer" && (req.user.role === "admin" || (req.user.role === "staff" && req.user.parentRole === "admin"));

        // Validate required fields
        if (!bookingId) {
            return res.status(400).json("Booking ID is required");
        }

        // Find the booking to cancel
        const existingBooking = await newBooking.findOne({
            tenantId: tenantId._id,
            bookingId: bookingId
        }).session(session);

        if (!existingBooking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (existingBooking.isreportready) {
            return res.status(400).json({ message: 'Booking not canceled because report has been processed' });
        }

        // Check if booking is already cancelled
        if (existingBooking.status === "cancelled") {
            return res.status(400).json({ message: 'Booking is already cancelled' });
        }

        // Generate cancellation transaction ID
        const cancellationTransactionId = `#CNL${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // Find all ledger entries related to this booking
        const relatedLedgerEntries = await Ledger.find({
            caseId: existingBooking._id
        }).session(session);

        if (relatedLedgerEntries.length === 0) {
            return res.status(404).json({ message: 'No ledger entries found for this booking' });
        }

        // Extract sampleBarcodeId from existing booking
        const sampleBarcodeId = existingBooking.tableData.map(entry => entry.barcodeId || entry.confirmBarcodeId).filter(id => id != null);

        if (
            req.user.role !== "admin" &&
            !(req.user.role === "staff" && req.user.parentRole === "admin")
        ) {
            // Process reversal for non-admin users

            // Find the booking user's debit entry (original booking entry)
            const bookingDebitEntry = relatedLedgerEntries.find(entry =>
                entry.type === "debit" && entry.userId.toString() === user.toString()
            );

            if (!bookingDebitEntry) {
                throw new ApiError(404, "Original booking entry not found");
            }

            // Fetch booking user
            const bookingUser = await User.findById(user).session(session);
            if (!bookingUser) {
                throw new ApiError(404, "Booking user not found");
            }

            // Credit back the amount to booking user
            const refundAmount = bookingDebitEntry.amount;
            const newBalanceForBookingUser = bookingUser.bookingWallet + refundAmount;

            // Create reversal ledger entry for booking user (credit back)
            const bookingCreditEntry = new Ledger({
                userId: bookingUser._id,
                username: bookingUser.username,
                amount: refundAmount,
                patientName: existingBooking.patientName,
                sampleBarcodeId: sampleBarcodeId,
                type: "credit",
                transactionId: cancellationTransactionId,
                description: `Booking cancellation refund for ${bookingId}`,
                balanceAfterTransaction: newBalanceForBookingUser,
                testDetails: bookingDebitEntry.testDetails,
                discountamount: issinglelayeradmin ? bookingDebitEntry.discountamount : 0,
                discountunit: issinglelayeradmin ? bookingDebitEntry.discountunit : 0,
                caseId: existingBooking._id
            });

            await bookingCreditEntry.save({ session });

            // Update booking user wallet
            bookingUser.bookingWallet = newBalanceForBookingUser;
            await bookingUser.save({ session });

            // Process commission reversals for all parent users
            const commissionEntries = relatedLedgerEntries.filter(entry =>
                entry.type === "credit" && entry.userId.toString() !== user.toString()
            );

            for (const commissionEntry of commissionEntries) {
                // Find the parent user
                const parentUser = await User.findById(commissionEntry.userId).session(session);
                if (!parentUser) {
                    console.warn(`Parent user ${commissionEntry.userId} not found. Skipping commission reversal.`);
                    continue;
                }

                // Debit the commission amount from parent user
                const commissionAmount = commissionEntry.amount;
                const newBalanceForParent = parentUser.bookingWallet - commissionAmount;

                // Create reversal ledger entry for parent (debit back)
                const parentDebitEntry = new Ledger({
                    userId: parentUser._id,
                    username: parentUser.username,
                    amount: commissionAmount,
                    type: "debit",
                    transactionId: cancellationTransactionId,
                    description: `Commission reversal for cancelled booking ${bookingId}`,
                    balanceAfterTransaction: newBalanceForParent,
                    receivedFrom: commissionEntry.receivedFrom,
                    myAmount: commissionEntry.myAmount,
                    testDetails: commissionEntry.testDetails,
                    patientName: existingBooking.patientName,
                    barcodeId: sampleBarcodeId,
                    discountamount: issinglelayeradmin ? commissionEntry.discountamount : 0,
                    discountunit: issinglelayeradmin ? commissionEntry.discountunit : 0,
                    caseId: existingBooking._id
                });

                await parentDebitEntry.save({ session });

                // Update parent user wallet
                parentUser.bookingWallet = newBalanceForParent;
                await parentUser.save({ session });
            }
        }

        if (req.user.role === "admin" || (req.user.role === 'staff' && req.user.parentRole === "admin")) {
            // For admin users, just create a reversal entry without wallet changes

            // Find the booking user's debit entry (original booking entry)
            const bookingDebitEntry = relatedLedgerEntries.find(entry =>
                entry.type === "debit" && entry.userId.toString() === user.toString()
            );

            if (bookingDebitEntry) {
                // Fetch booking user
                const bookingUser = await User.findById(user).session(session);
                if (bookingUser) {
                    // Create reversal ledger entry for admin booking cancellation
                    const adminCancellationEntry = new Ledger({
                        userId: bookingUser._id,
                        username: bookingUser.username,
                        amount: bookingDebitEntry.amount,
                        patientName: existingBooking.patientName,
                        sampleBarcodeId: sampleBarcodeId,
                        type: "credit",
                        transactionId: cancellationTransactionId,
                        description: `Admin booking cancellation for ${bookingId}`,
                        discountamount: issinglelayeradmin ? bookingDebitEntry.discountamount : 0,
                        discountunit: issinglelayeradmin ? bookingDebitEntry.discountunit : 0,
                        caseId: existingBooking._id
                    });

                    await adminCancellationEntry.save({ session });
                }
            }

            // Remove from acceptedBarcode collection
            for (const tableEntry of existingBooking.tableData) {
                const barcodeToRemove = tableEntry.barcodeId || tableEntry.confirmBarcodeId;

                if (barcodeToRemove) {
                    // Remove the specific barcode from the barcodes array
                    await acceptedBarcode.updateOne(
                        {
                            tenantId: tenantId._id,
                            bookingId: bookingId
                        },
                        {
                            $pull: {
                                barcodes: { barcode: barcodeToRemove }
                            }
                        },
                        { session }
                    );

                    // If no barcodes left, remove the entire document
                    const remainingBarcodes = await acceptedBarcode.findOne({
                        tenantId: tenantId._id,
                        bookingId: bookingId
                    }).session(session);

                    if (remainingBarcodes && remainingBarcodes.barcodes.length === 0) {
                        await acceptedBarcode.deleteOne({
                            tenantId: tenantId._id,
                            bookingId: bookingId
                        }, { session });
                    }
                }
            }
        }

        // Update booking status to cancelled
        existingBooking.status = "cancelled";
        existingBooking.cancelledAt = new Date();
        existingBooking.cancelledBy = req.user._id;
        await existingBooking.save({ session });

        // Add activity for staff cancellation
        if (req.user.role === 'staff') {
            await User.findByIdAndUpdate(req.user._id, {
                $push: {
                    activities: {
                        activityType: "booking_cancellation",
                        details: {
                            staffId: req.user._id,
                            staffName: req.user.fullName,
                            action: `${req.user.fullName} cancelled a booking`,
                            patientName: existingBooking.patientName,
                            patientBookingId: existingBooking._id
                        },
                        reference: {
                            model: "Booking",
                            id: existingBooking._id
                        },
                        timestamp: new Date()
                    }
                }
            }, { session });
        }

        res.status(200).json(new ApiResponse(200, existingBooking, "Booking cancelled successfully and all transactions reversed"));

        // Commit the transaction if everything is successful
        await session.commitTransaction();
        session.endSession(); // End the session

    } catch (err) {
        // Rollback the transaction if anything goes wrong
        await session.abortTransaction();
        session.endSession();
        console.error("Cancellation transaction failed:", err);
        throw err; // Rethrow error to handle it further
    }
});

// ========================================
// SEARCH BOOKING API
// ========================================

const SearchBookingController = asyncHandler(async (req, res) => {
    try {
        const { bookingId, patientName } = req.body;
        const tenantId = req.user.tenantId;

        // Validate required fields
        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: 'Booking ID is required'
            });
        }

        // Build search query
        let searchQuery = {
            tenantId: tenantId._id,
            bookingId: bookingId
        };

        // Add patient name filter if provided
        if (patientName && patientName.trim()) {
            searchQuery.patientName = {
                $regex: patientName.trim(),
                $options: 'i' // Case insensitive
            };
        }

        // Find the booking with populated data
        const booking = await newBooking.findOne(searchQuery)
            .populate('createdBy', 'fullName username')
            .populate('subFranchiseeId', 'name')
            .populate('savedDoctorId', 'name')
            .populate('savedLabId', 'name');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Get test names for table data
        const enhancedTableData = await Promise.all(
            booking.tableData.map(async (entry) => {
                let testNames = [];

                if (entry.ids && entry.ids.length > 0) {
                    for (const idObj of entry.ids) {
                        try {
                            let testDoc = null;

                            if (idObj.collectionName === "testSchema") {
                                testDoc = await testSchema.findById(idObj.id).select('Name');
                                if (testDoc) testNames.push(testDoc.Name);
                            } else if (idObj.collectionName === "addPannel") {
                                testDoc = await addPannel.findById(idObj.id).select('name');
                                if (testDoc) testNames.push(testDoc.name);
                            } else if (idObj.collectionName === "Package") {
                                testDoc = await Package.findById(idObj.id).select('packageName');
                                if (testDoc) testNames.push(testDoc.packageName);
                            }
                        } catch (error) {
                            console.log(`Error fetching test ${idObj.id}:`, error);
                        }
                    }
                }

                return {
                    ...entry,
                    testNames: testNames,
                    barcodeId: entry.barcodeId || entry.confirmBarcodeId
                };
            })
        );

        // Prepare response data
        const bookingData = {
            _id: booking._id,
            bookingId: booking.bookingId,
            patientName: booking.patientName,
            patientPhone: booking.patientPhone,
            date: booking.date,
            time: booking.time,
            year: booking.year,
            gender: booking.gender,
            doctorName: booking.doctorName,
            labName: booking.labName,
            franchisee: booking.franchisee,
            subFranchisee: booking.subFranchisee,
            courierName: booking.courierName,
            courierId: booking.courierId,
            clinicalHistory: booking.clinicalHistory,
            total: booking.total,
            status: booking.status || 'pending',
            tableData: enhancedTableData,
            createdBy: booking.createdBy,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt,
            cancelledAt: booking.cancelledAt,
            cancelledBy: booking.cancelledBy,
            discountamount: booking.discountamount || 0,
            discountunit: booking.discountunit || 0
        };

        res.status(200).json({
            success: true,
            message: 'Booking found successfully',
            data: bookingData
        });

    } catch (error) {
        console.error("Search booking error:", error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

const editbookingbookedtests = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {
            barcodeId, date, time, courierName, courierId, patientName,
            year, gender, patientPhone, doctorName, labName, franchisee,
            clinicalHistory, subFranchisee, savedDoctor,
            savedLab, subFranchiseeId, savedDoctorId, savedLabId, total, tableData, testIds,
            createdbyuser, discountamount, discountunit
        } = req.body;

        let userId;
        if (req.user.role === "staff") {
            userId = req.user.parentUser;
        } else {
            userId = req.user._id;
        }
        const tenantId = req.user.tenantId;
        let issinglelayeradmin = false;
        issinglelayeradmin = tenantId.modelType === "1layer" && req.user.role === "admin";

        const parsedSubFranchiseeId = subFranchiseeId === "null" ? null : subFranchiseeId;
        const parsedSavedDoctorId = savedDoctorId === "null" ? null : savedDoctorId;
        const parsedSavedLabId = savedLabId === "null" ? null : savedLabId;
        const parsedTotal = Number(total);

        let tableData2 = tableData;
        if (typeof tableData === "string") {
            tableData2 = JSON.parse(tableData);
        }

        if (!Array.isArray(tableData2)) {
            console.error("Error: tableData is not an array", tableData);
            return res.status(500).json({ error: "Invalid data format" });
        }

        // Ensure all barcodeIds are present (non-empty)
        for (const element of tableData2) {
            const barcodeValue = element.confirmBarcodeId || element.barcodeId;
            if (!barcodeValue || barcodeValue.trim() === "") {
                return res.status(400).json({
                    message: `Barcode ID is missing for sample type "${element.typeOfSample || 'Unknown'}"`
                });
            }
        }


        // Validate barcodes uniqueness (excluding current booking)
        for (const element of tableData2) {
            const isBarcodeIdPresent = await newBooking.findOne({
                bookingId: { $ne: barcodeId },
                'tableData.barcodeId': element.confirmBarcodeId
            }).session(session);

            if (isBarcodeIdPresent) {
                return res.status(400).json(`${element.confirmBarcodeId} barcode already present`);
            }
        }

        if (!patientName) {
            return res.status(400).json("Patient Name is required");
        }

        // Get existing booking
        const existingBooking = await newBooking.findOne({
            tenantId: tenantId._id,
            bookingId: barcodeId,
            createdBy: userId
        }).session(session);

        if (existingBooking.status === "cancelled") {
            return res.status(404).json({ message: 'Booking has been Cancelled' });
        }

        if (!existingBooking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Handle file upload
        let fileLink = null;
        if (req.files?.file?.length > 0) {
            const uploadableFilepath = req.files.file[0].path;
            fileLink = await uploadOnCloudinary(uploadableFilepath);
        }

        // Parse data
        let parsedTableData, parsedSelectedTestIds;
        try {
            parsedTableData = JSON.parse(tableData);
            parsedSelectedTestIds = JSON.parse(testIds);
        } catch (error) {
            throw new ApiError(400, "Invalid JSON format for tableData or testIds");
        }

        const sampleBarcodeId = parsedTableData.map(entry => entry.confirmBarcodeId).filter(id => id != null);

        // === STRICT CHECK: Duplicate Tests in SAME Barcode + TypeOfSample ===
        const existingTableData = existingBooking.tableData || [];
        const duplicateTests = [];
        const duplicateBarcodes = [];

        // Check 1: Barcode uniqueness across entire database (excluding current booking)
        for (const newEntry of parsedTableData) {
            const barcodeInOtherBooking = await newBooking.findOne({
                bookingId: { $ne: barcodeId },
                'tableData.barcodeId': newEntry.confirmBarcodeId || newEntry.barcodeId
            }).session(session);

            if (barcodeInOtherBooking) {
                duplicateBarcodes.push(newEntry.confirmBarcodeId || newEntry.barcodeId);
            }
        }

        if (duplicateBarcodes.length > 0) {
            return res.status(400).json({
                message: 'Barcode already exists in another booking',
                duplicateBarcodes: [...new Set(duplicateBarcodes)]
            });
        }

        // Check 2: Within current booking - same barcode can't have different typeOfSample
        parsedTableData.forEach(newEntry => {
            const newBarcodeId = newEntry.confirmBarcodeId || newEntry.barcodeId;
            const newTypeOfSample = newEntry.typeOfSample;

            existingTableData.forEach(existing => {
                // If same barcode but different typeOfSample
                if (existing.barcodeId === newBarcodeId && existing.typeOfSample !== newTypeOfSample) {
                    duplicateBarcodes.push(`${newBarcodeId} (Type conflict: ${existing.typeOfSample} vs ${newTypeOfSample})`);
                }
            });
        });

        if (duplicateBarcodes.length > 0) {
            return res.status(400).json({
                message: 'Same barcode cannot have different sample types',
                conflicts: [...new Set(duplicateBarcodes)]
            });
        }

        // Check 3: Duplicate tests in SAME barcode + SAME typeOfSample
        parsedTableData.forEach(newEntry => {
            const newBarcodeId = newEntry.confirmBarcodeId || newEntry.barcodeId;
            const newTypeOfSample = newEntry.typeOfSample;

            // Find exact match: same barcode AND same typeOfSample
            const matchingExisting = existingTableData.find(
                existing =>
                    existing.barcodeId === newBarcodeId &&
                    existing.typeOfSample === newTypeOfSample
            );

            if (matchingExisting) {
                // Check for duplicate test names
                if (matchingExisting.testName && newEntry.testName) {
                    const existingTestNames = matchingExisting.testName.split(',').map(t => t.trim().toLowerCase());
                    const newTestNames = newEntry.testName.split(',').map(t => t.trim().toLowerCase());

                    newTestNames.forEach(testName => {
                        if (existingTestNames.includes(testName)) {
                            duplicateTests.push(testName);
                        }
                    });
                }

                // Check for duplicate IDs (id + collectionName)
                const existingIds = matchingExisting.ids || [];
                const newIds = newEntry.ids || [];

                newIds.forEach(newId => {
                    const isDuplicate = existingIds.some(
                        existingId =>
                            existingId.id.toString() === newId.id.toString() &&
                            existingId.collectionName === newId.collectionName
                    );
                    if (isDuplicate) {
                        duplicateTests.push(`${newId.collectionName}-${newId.id}`);
                    }
                });
            }
        });

        if (duplicateTests.length > 0) {
            return res.status(400).json({
                message: 'Tests already exist in this booking',
                duplicateTests: [...new Set(duplicateTests)]
            });
        }

        // === MERGE LOGIC: Safe to proceed ===
        const mergedTableData = [...existingTableData];

        parsedTableData.forEach(newEntry => {
            const newBarcodeId = newEntry.confirmBarcodeId || newEntry.barcodeId;
            const newTypeOfSample = newEntry.typeOfSample;

            const matchingIndex = mergedTableData.findIndex(
                existing =>
                    existing.barcodeId === newBarcodeId &&
                    existing.typeOfSample === newTypeOfSample
            );

            if (matchingIndex !== -1) {
                // MERGE: Same barcode + Same typeOfSample found
                const existing = mergedTableData[matchingIndex];

                // Merge testNames (remove duplicates)
                const existingTestNames = existing.testName ? existing.testName.split(',').map(t => t.trim()) : [];
                const newTestNames = newEntry.testName ? newEntry.testName.split(',').map(t => t.trim()) : [];
                const mergedTestNames = [...new Set([...existingTestNames, ...newTestNames])];

                // Merge ids (remove duplicates)
                const existingIds = existing.ids || [];
                const newIds = newEntry.ids || [];
                const mergedIds = [...existingIds];

                newIds.forEach(newId => {
                    const isDuplicate = existingIds.some(
                        existingId =>
                            existingId.id.toString() === newId.id.toString() &&
                            existingId.collectionName === newId.collectionName
                    );
                    if (!isDuplicate) {
                        mergedIds.push(newId);
                    }
                });

                // Update existing entry
                mergedTableData[matchingIndex] = {
                    typeOfSample: newTypeOfSample,
                    barcodeId: newBarcodeId,
                    testName: mergedTestNames.join(', '),
                    ids: mergedIds
                };
            } else {
                // ADD NEW: Different barcode OR different typeOfSample
                mergedTableData.push({
                    typeOfSample: newTypeOfSample,
                    barcodeId: newBarcodeId,
                    testName: newEntry.testName || '',
                    ids: newEntry.ids || []
                });
            }
        });

        // === Wallet and Ledger Logic (Non-Admin) ===
        if (req.user.role !== "admin") {
            const bookingUser = await User.findById(userId).session(session);
            if (!bookingUser) {
                throw new ApiError(404, "Booking user not found");
            }

            const balanceAfterTransaction = bookingUser.bookingWallet - parsedTotal;
            const testDetailsForCurrentUser = [];
            const transactionId = `#CR${Date.now()}${Math.floor(Math.random() * 1000)}`;
            const parentUserCache = new Map();

            for (const item of parsedSelectedTestIds) {
                const testOrPackage = await testSchema.findById(item) ||
                    await addPannel.findById(item) ||
                    await Package.findById(item);

                if (!testOrPackage) {
                    throw new ApiError(404, `Test/Package with ID ${item} not found`);
                }

                const assignedPrices = testOrPackage.assignedPrices;
                let currentPrice = assignedPrices.find(price => price.userId.toString() === bookingUser._id.toString())?.price;

                if (!currentPrice) {
                    throw new ApiError(403, "No assigned price found for the current user");
                }

                testDetailsForCurrentUser.push({
                    testName: testOrPackage.name || testOrPackage.packageName || testOrPackage.Name,
                    testPrice: currentPrice,
                });

                let parentId = bookingUser.createdBy || bookingUser.parentUser;
                let childUsername = bookingUser.username;

                while (parentId) {
                    let parentUser = parentUserCache.get(parentId);
                    if (!parentUser) {
                        parentUser = await User.findById(parentId);
                        if (!parentUser) break;
                        parentUserCache.set(parentId, parentUser);
                    }

                    const parentPrice = assignedPrices.find(price => price.userId.toString() === parentUser._id.toString())?.price;

                    if (!parentPrice) {
                        parentId = parentUser.createdBy || parentUser.parentUser;
                        continue;
                    }

                    const commissionForParent = currentPrice - parentPrice;

                    if (commissionForParent <= 0) {
                        parentId = parentUser.createdBy || parentUser.parentUser;
                        continue;
                    }

                    const parentLedgerEntry = new Ledger({
                        userId: parentUser._id,
                        username: parentUser.username,
                        amount: commissionForParent,
                        type: "credit",
                        transactionId,
                        description: `${barcodeId}`,
                        balanceAfterTransaction: parentUser.bookingWallet + commissionForParent,
                        receivedFrom: childUsername,
                        myAmount: currentPrice,
                        testDetails: [{
                            testName: testOrPackage.name || testOrPackage.packageName || testOrPackage.Name,
                            testPrice: currentPrice,
                            commissionAmount: commissionForParent,
                        }],
                        patientName: patientName,
                        barcodeId: sampleBarcodeId,
                    });

                    await parentLedgerEntry.save({ session });
                    parentUser.bookingWallet += commissionForParent;
                    await parentUser.save({ session });

                    parentId = parentUser.createdBy;
                    childUsername = parentUser.username;
                    currentPrice = parentPrice;
                }
            }

            const bookingLedgerEntry = new Ledger({
                userId: bookingUser._id,
                username: bookingUser.username,
                amount: parsedTotal,
                patientName: patientName,
                sampleBarcodeId: sampleBarcodeId,
                type: "debit",
                transactionId,
                description: `Booking for ${barcodeId}`,
                balanceAfterTransaction,
                testDetails: testDetailsForCurrentUser,
            });

            await bookingLedgerEntry.save({ session });
            bookingUser.bookingWallet = balanceAfterTransaction;
            await bookingUser.save({ session });
        }

        // === Update Booking Document ===
        const updateObject = {
            date,
            time,
            courierName,
            courierId,
            patientName,
            year,
            gender,
            patientPhone,
            doctorName,
            labName,
            franchisee,
            clinicalHistory,
            file: fileLink?.url || existingBooking.file,
            tableData: mergedTableData, // Use merged data
            total: existingBooking.total + parsedTotal, // Add to existing total
            subFranchisee: subFranchisee || "",
            subFranchiseeId: parsedSubFranchiseeId,
            savedDoctor: savedDoctor || "",
            savedDoctorId: parsedSavedDoctorId,
            savedLab: savedLab || "",
            discountamount: issinglelayeradmin ? Number(discountamount) : existingBooking.discountamount,
            discountunit: issinglelayeradmin ? Number(discountunit) : existingBooking.discountunit,
            createdbyuser: createdbyuser,
        };

        const updatedDoc = await newBooking.findOneAndUpdate(
            {
                tenantId: tenantId._id,
                bookingId: barcodeId,
                createdBy: userId
            },
            { $set: updateObject },
            { new: true, session }
        );

        if (!updatedDoc) {
            throw new ApiError(404, "Failed to update booking");
        }

        // === Admin-specific: Update acceptedBarcode ===
        if (req.user.role === "admin") {
            await acceptedBarcode.findOneAndDelete({
                bookingId: barcodeId,
            });

            for (const element of parsedTableData) {
                const testResults = await Promise.all(
                    element.ids.map(async obj => {
                        if (obj.collectionName === "testSchema") {
                            const doc = await testSchema.findById(obj.id).select('Name');
                            return doc ? { names: [doc.Name], objects: [obj] } : { names: [], objects: [] };
                        }
                        if (obj.collectionName === "addPannel") {
                            const doc = await addPannel.findById(obj.id).select('name');
                            return doc ? { names: [doc.name], objects: [obj] } : { names: [], objects: [] };
                        }
                        if (obj.collectionName === "Package") {
                            const doc = await Package.findById(obj.id)
                                .select('testIds pannelIds')
                                .populate('testIds pannelIds');

                            if (!doc) return { names: [], objects: [] };

                            const packageTestNames = [];
                            const packageTestObjects = [];
                            const packagePanelNames = [];
                            const packagePanelObjects = [];

                            doc.testIds.forEach(test => {
                                if (test.sampleType === element.typeOfSample) {
                                    packageTestNames.push(test.Name);
                                    packageTestObjects.push({ id: test._id, collectionName: "testSchema" });
                                }
                            });

                            doc.pannelIds.forEach(panel => {
                                if (panel.sampleType === element.typeOfSample) {
                                    packagePanelNames.push(panel.name);
                                    packagePanelObjects.push({ id: panel._id, collectionName: "addPannel" });
                                }
                            });

                            return {
                                names: [...packageTestNames, ...packagePanelNames],
                                objects: [...packageTestObjects, ...packagePanelObjects]
                            };
                        }
                        return { names: [], objects: [] };
                    })
                );

                const testnames = testResults.flatMap(r => r.names);
                const testObjects = testResults.flatMap(r => r.objects);

                const existingBarcode = await acceptedBarcode.findOne({
                    "barcodes.barcode": element.confirmBarcodeId,
                });

                if (existingBarcode) {
                    return res.status(400).json({ message: "This barcode is already accepted." });
                }

                const savedbarcode = await acceptedBarcode.findOne({ bookingId: barcodeId });

                if (savedbarcode) {
                    await acceptedBarcode.updateOne(
                        { bookingId: barcodeId },
                        {
                            $addToSet: {
                                barcodes: {
                                    barcode: element.confirmBarcodeId,
                                    testandpannelArray: testnames,
                                    sampleType: element.typeOfSample,
                                    testIds: testObjects
                                }
                            }
                        }
                    );
                } else {
                    const newBarcodeDocument = new acceptedBarcode({
                        tenantId: tenantId._id,
                        bookingId: barcodeId,
                        barcodes: [{
                            barcode: element.confirmBarcodeId,
                            testandpannelArray: testnames,
                            sampleType: element.typeOfSample,
                            testIds: testObjects
                        }],
                    });
                    await newBarcodeDocument.save({ session });
                }
            }
        }

        if (req.user.role === 'staff') {
            await User.findByIdAndUpdate(req.user._id, {
                $push: {
                    activities: {
                        activityType: "other",
                        details: {
                            staffId: req.user._id,
                            staffName: req.user.fullName,
                            action: `${req.user.fullName} edited booked tests in a booking`,
                            bookingName: updatedDoc.patientName,
                            bookingId: updatedDoc.bookingId,

                        },
                        reference: {
                            model: "Booking",
                            id: updatedDoc._id
                        },
                        timestamp: new Date()
                    }
                }
            });
        }

        // Commit transaction

        await session.commitTransaction();
        session.endSession();

        res.status(200).json(new ApiResponse(200, updatedDoc, "Test edited successfully and commissions distributed"));

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error("Transaction failed:", err);
        throw err;
    }
}

const editBookingBarcodes = async (req, res) => {
    try {
        const { tableData, id } = req.body;
        let userId;
        if (req.user.role === 'staff') {
            userId = req.user.parentUser
        } else {
            userId = req.user._id
        }

        // Validate
        if (!id || !Array.isArray(tableData)) {
            return res.status(400).json({ message: "Invalid input" });
        }

        for (const element of tableData) {
            const barcodepresent = await newBooking.findOne({
                tenantId: req.user.tenantId._id,
                "tableData.barcodeId": element.barcodeId,
                _id: { $ne: id }
            })

            if (barcodepresent) {
                return res.status(402).json({ message: `${element.barcodeId} already present` });
            }
        }
        // Fetch the document
        const booking = await newBooking.findOne({
            _id: id,
            tenantId: req.user.tenantId._id,
            createdBy: userId
        });

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // Update barcodeIds in tableData
        booking.tableData = tableData;

        // Save the document
        await booking.save();

        // अगर staff का parentUser है तो उसे भी notify करें
        if (req.user.role === 'staff') {
            await User.findByIdAndUpdate(req.user._id, {
                $push: {
                    activities: {
                        activityType: "other",
                        details: {
                            staffId: req.user._id,
                            staffName: req.user.fullName,
                            action: `${req.user.fullName} updated barcodes in a booking`,
                            bookingName: booking.patientName,
                            bookingId: booking.bookingId,

                        },
                        reference: {
                            model: "Booking",
                            id: booking._id
                        },
                        timestamp: new Date()
                    }
                }
            });
        }

        res.status(200).json({ message: "Barcodes updated successfully", booking });

    } catch (error) {
        console.error("Error updating barcodes:", error);
        res.status(500).json({ message: "Something went wrong" });
    }
};


const allBookingsController = asyncHandler(async (req, res) => {

    const tenantId = req.user.tenantId._id;
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }


    const lastBookingDetails = await newBooking.findOne({
        tenantId: tenantId,
        createdBy: userId
    }).sort({ createdAt: -1 })

    if (!lastBookingDetails) {
        return res.status(200).json({ message: "not found", status: "empty" });
    }

    return res.status(200).json(lastBookingDetails);
})

const getAllBookingsController = asyncHandler(async (req, res) => {
    const pageNumber = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const {
        regNo,
        patientName,
        gender,
        patientPhone,
        labName,
        status,
        franchisee,
        barcode
    } = req.body;

    const skip = (pageNumber - 1) * limitNumber;

    let query = {
        tenantId: req.user.tenantId._id,
        status: { $nin: ["cancelled", "canceled"] }
    };

    // Apply basic filters
    if (regNo) query.bookingId = { $regex: regNo, $options: 'i' };
    if (patientName) query.patientName = { $regex: patientName, $options: 'i' };
    if (gender) query.gender = { $regex: gender, $options: 'i' };
    if (patientPhone) query.patientPhone = { $regex: patientPhone, $options: 'i' };
    if (labName) query.labName = { $regex: labName, $options: 'i' };
    if (status) query.status = { $regex: status, $options: 'i' };
    if (franchisee) query.createdbyuser = { $regex: franchisee, $options: 'i' };

    // Handle barcode filter
    if (barcode) {
        const barcodeDocs = await acceptedBarcode.find(
            {
                tenantId: req.user.tenantId._id,
                "barcodes.barcode": { $regex: barcode, $options: 'i' }
            },
            { bookingId: 1 }
        ).lean();

        if (barcodeDocs.length > 0) {
            const bookingIds = barcodeDocs.map(doc => doc.bookingId);
            query.bookingId = { $in: bookingIds };
        } else {
            return res.status(200).json({
                bookings: [],
                total: 0,
                page: pageNumber,
                limit: limitNumber,
            });
        }
    }

    // Fetch bookings with pagination
    const bookings = await newBooking
        .find(query)
        .select(BOOKING_LIST_PROJECTION)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean();

    const total = await newBooking.countDocuments(query);

    // Process barcodes and LIS data for current page bookings
    if (bookings.length > 0) {
        const bookingIds = bookings.map(b => b.bookingId);

        // Fetch barcodes for current page
        const barcodeData = await acceptedBarcode.find(
            {
                tenantId: req.user.tenantId._id,
                bookingId: { $in: bookingIds }
            },
            { bookingId: 1, barcodes: 1 }
        ).lean();

        // Create barcode map
        const barcodeMap = new Map();
        const allBarcodeIds = []; // Collect all barcode IDs for LIS check

        barcodeData.forEach(doc => {
            const barcodes = (doc.barcodes || []).map((b) => ({
                barcode: b?.barcode || "",
                sampleType: b?.sampleType || ""
            })).filter((b) => b.barcode);
            barcodeMap.set(doc.bookingId, barcodes);
            allBarcodeIds.push(...barcodes.map((b) => b.barcode));
        });

        // Check LIS data availability for all barcodes in one query
        let lisAvailabilityMap = new Map();

        if (allBarcodeIds.length > 0) {
            const lisDataDocs = await lisdata.find(
                { "lisData.sample_id": { $in: allBarcodeIds } },
                { "lisData.sample_id": 1 }
            ).lean();

            // Create a set of barcodes that have LIS data for O(1) lookup
            const barcodesWithLis = new Set(
                lisDataDocs.map(doc => doc.lisData?.sample_id).filter(Boolean)
            );

            // Map each barcode to its LIS availability
            allBarcodeIds.forEach(barcodeId => {
                lisAvailabilityMap.set(barcodeId, barcodesWithLis.has(barcodeId));
            });
        }

        // Attach barcodes and LIS status to each booking
        bookings.forEach(booking => {
            const bookingBarcodes = barcodeMap.get(booking.bookingId) || [];

            // Create detailed barcode status array
            const barcodeDetails = bookingBarcodes.map(({ barcode, sampleType }) => ({
                barcode,
                sampleType,
                isLisPresent: lisAvailabilityMap.get(barcode) || false
            }));

            // Backward compatibility - keep old format
            booking.acceptedbarcode = bookingBarcodes.map(({ barcode }) => barcode);

            // New detailed format
            booking.barcodeDetails = barcodeDetails;

            // Overall LIS status - true if ANY barcode has LIS data
            booking.isLisPresent = barcodeDetails.length > 0
                ? barcodeDetails.some(detail => detail.isLisPresent === true)
                : false;

            // Additional stats
            booking.lisStats = {
                total: barcodeDetails.length,
                withLis: barcodeDetails.filter(d => d.isLisPresent).length,
                withoutLis: barcodeDetails.filter(d => !d.isLisPresent).length
            };
        });
    }

    const bookingsWithAttachments = await attachBookingAttachments(bookings, req.user.tenantId._id);

    return res.status(200).json({
        bookings: bookingsWithAttachments,
        total,
        page: pageNumber,
        limit: limitNumber,
    });
});

function escapeRegex(value = "") {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function collectHierarchyUserIds(rootUserId, tenantId) {
    if (!rootUserId || !mongoose.Types.ObjectId.isValid(rootUserId)) {
        return [];
    }

    const collectedIds = new Set([rootUserId.toString()]);
    let frontier = [rootUserId.toString()];

    while (frontier.length > 0) {
        const children = await User.find({
            tenantId,
            createdBy: { $in: frontier }
        }).select("_id").lean();

        frontier = [];

        children.forEach((child) => {
            const childId = child._id.toString();
            if (!collectedIds.has(childId)) {
                collectedIds.add(childId);
                frontier.push(childId);
            }
        });
    }

    return Array.from(collectedIds).map((id) => new mongoose.Types.ObjectId(id));
}

async function attachBookingBarcodeDetails(bookings, tenantId) {
    if (!bookings.length) {
        return bookings;
    }

    const bookingIds = bookings.map((booking) => booking.bookingId);
    const barcodeDocs = await acceptedBarcode.find(
        {
            tenantId,
            bookingId: { $in: bookingIds }
        },
        { bookingId: 1, barcodes: 1 }
    ).lean();

    const barcodeMap = new Map();
    barcodeDocs.forEach((doc) => {
        barcodeMap.set(
            doc.bookingId,
            (doc.barcodes || []).map((item) => item.barcode).filter(Boolean)
        );
    });

    return bookings.map((booking) => {
        const acceptedBarcodes = barcodeMap.get(booking.bookingId) || [];
        const fallbackBarcodes = Array.isArray(booking.tableData)
            ? booking.tableData.map((item) => item.barcodeId).filter(Boolean)
            : [];

        const barcodeList = [...new Set(
            acceptedBarcodes.length > 0 ? acceptedBarcodes : fallbackBarcodes
        )];

        return {
            ...booking,
            barcodeList,
            primaryBarcode: barcodeList[0] || ""
        };
    });
}

function normalizeBookingStatusKey(status = "") {
    const normalized = status.trim().toLowerCase();

    if (normalized === "completed") return "completed";
    if (normalized === "pending") return "pending";
    if (normalized === "partially completed" || normalized === "partial completed" || normalized === "partial") {
        return "partiallyCompleted";
    }
    if (normalized === "hold" || normalized === "on hold") return "hold";
    if (normalized === "clinical" || normalized === "clinical stated") return "clinical";

    return "other";
}

const getAdminListBookingsController = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId._id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const {
        bookingOrBarcode = "",
        patientName = "",
        mobileNumber = "",
        status = "",
        startDate = "",
        endDate = "",
        hierarchyUserId = "",
        sortBy = "latest",
        sortOrder = "desc"
    } = req.query;

    const andConditions = [
        { tenantId },
        { status: { $nin: ["cancelled", "cancelled"] } }
    ];

    if (patientName.trim()) {
        andConditions.push({
            patientName: { $regex: escapeRegex(patientName.trim()), $options: "i" }
        });
    }

    if (mobileNumber.trim()) {
        andConditions.push({
            patientPhone: { $regex: escapeRegex(mobileNumber.trim()), $options: "i" }
        });
    }

    if (status.trim()) {
        andConditions.push({
            status: { $regex: `^${escapeRegex(status.trim())}$`, $options: "i" }
        });
    }

    if (startDate || endDate) {
        const dateQuery = {};

        if (startDate) {
            const parsedStartDate = new Date(startDate);
            parsedStartDate.setHours(0, 0, 0, 0);
            dateQuery.$gte = parsedStartDate;
        }

        if (endDate) {
            const parsedEndDate = new Date(endDate);
            parsedEndDate.setHours(23, 59, 59, 999);
            dateQuery.$lte = parsedEndDate;
        }

        andConditions.push({ date: dateQuery });
    }

    if (bookingOrBarcode.trim()) {
        const bookingRegex = new RegExp(escapeRegex(bookingOrBarcode.trim()), "i");
        const barcodeDocs = await acceptedBarcode.find(
            {
                tenantId,
                "barcodes.barcode": bookingRegex
            },
            { bookingId: 1 }
        ).lean();

        const barcodeBookingIds = barcodeDocs.map((doc) => doc.bookingId);
        const bookingOrBarcodeConditions = [
            { bookingId: bookingRegex },
            { "tableData.barcodeId": bookingRegex }
        ];

        if (barcodeBookingIds.length > 0) {
            bookingOrBarcodeConditions.push({ bookingId: { $in: barcodeBookingIds } });
        }

        andConditions.push({ $or: bookingOrBarcodeConditions });
    }

    if (hierarchyUserId) {
        const hierarchyUserIds = await collectHierarchyUserIds(hierarchyUserId, tenantId);
        andConditions.push({
            createdBy: { $in: hierarchyUserIds.length ? hierarchyUserIds : [] }
        });
    }

    const query = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const sortFieldMap = {
        latest: "createdAt",
        date: "date",
        name: "patientName",
        status: "status"
    };

    const resolvedSortField = sortFieldMap[sortBy] || "createdAt";
    const resolvedSortOrder = sortOrder === "asc" ? 1 : -1;
    const sortConfig = {
        [resolvedSortField]: resolvedSortOrder,
        createdAt: -1
    };

    const bookingsQuery = newBooking.find(query)
        .select(BOOKING_LIST_PROJECTION)
        .populate("createdBy", "fullName username role")
        .sort(sortConfig)
        .skip(skip)
        .limit(limit)
        .lean();

    const totalQuery = newBooking.countDocuments(query);
    const summaryQuery = newBooking.aggregate([
        { $match: query },
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 }
            }
        }
    ]);

    let [bookings, total, summaryRows] = await Promise.all([
        bookingsQuery,
        totalQuery,
        summaryQuery
    ]);

    bookings = await attachBookingBarcodeDetails(bookings, tenantId);
    bookings = await attachBookingAttachments(bookings, tenantId);

    const summary = {
        total,
        pending: 0,
        completed: 0,
        partiallyCompleted: 0,
        hold: 0,
        clinical: 0,
        other: 0
    };

    summaryRows.forEach((row) => {
        const key = normalizeBookingStatusKey(row._id || "");
        summary[key] = (summary[key] || 0) + row.count;
    });

    return res.status(200).json({
        bookings,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        summary
    });
});

const getDashboardDataController = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId._id;
    const userRole = req.user.role;
    const permissions = req.user.permissions || {};

    const bookingMatch = { tenantId };
    const franchiseeQuery = (permissions.canManageUsers || userRole !== 'staff')
        ? User.find({
            tenantId,
            role: { $ne: 'staff' },
            isActive: true
        })
            .select('fullName address phoneNo email isActive')
            .lean()
        : Promise.resolve([]);

    const statsQuery = newBooking.aggregate([
        { $match: bookingMatch },
        {
            $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                totalRevenue: { $sum: { $ifNull: ["$total", 0] } },
                pendingTests: {
                    $sum: {
                        $cond: [{ $eq: ["$status", "pending"] }, 1, 0]
                    }
                }
            }
        }
    ]);

    const monthlyRevenueQuery = newBooking.aggregate([
        { $match: bookingMatch },
        { $match: { date: { $type: "date" } } },
        {
            $group: {
                _id: {
                    year: { $year: "$date" },
                    month: { $month: "$date" }
                },
                total: { $sum: { $ifNull: ["$total", 0] } }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const dailyRevenueQuery = newBooking.aggregate([
        { $match: bookingMatch },
        { $match: { date: { $type: "date" } } },
        {
            $group: {
                _id: {
                    year: { $year: "$date" },
                    month: { $month: "$date" },
                    day: { $dayOfMonth: "$date" }
                },
                total: { $sum: { $ifNull: ["$total", 0] } }
            }
        },
        { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
        { $limit: 30 },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    const topTestsQuery = newBooking.aggregate([
        { $match: bookingMatch },
        {
            $project: {
                firstTestName: { $arrayElemAt: ["$tableData.testName", 0] }
            }
        },
        {
            $match: {
                firstTestName: { $exists: true, $ne: null, $ne: "" }
            }
        },
        {
            $group: {
                _id: "$firstTestName",
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 4 }
    ]);

    const [statsRows, monthlyRows, dailyRows, topTestRows, franchisees] = await Promise.all([
        statsQuery,
        monthlyRevenueQuery,
        dailyRevenueQuery,
        topTestsQuery,
        franchiseeQuery
    ]);

    // Initialize response structure
    const response = {
        stats: {
            totalBookings: 0,
            totalRevenue: 0,
            pendingTests: 0,
            activeFranchises: 0
        },
        charts: {
            monthlyRevenue: { labels: [], data: [] },
            dailyRevenue: { labels: [], data: [] },
            topTests: { labels: [], data: [] }
        },
        franchisees: []
    };

    const stats = statsRows[0] || {
        totalBookings: 0,
        totalRevenue: 0,
        pendingTests: 0
    };

    response.stats = {
        totalBookings: stats.totalBookings,
        totalRevenue: Math.round(stats.totalRevenue || 0),
        pendingTests: stats.pendingTests,
        activeFranchises: franchisees.length
    };

    response.charts.monthlyRevenue = {
        labels: monthlyRows.map((row) => `${row._id.year}-${String(row._id.month).padStart(2, '0')}`),
        data: monthlyRows.map((row) => Math.round(row.total || 0))
    };

    response.charts.dailyRevenue = {
        labels: dailyRows.map((row) => `${row._id.year}-${String(row._id.month).padStart(2, '0')}-${String(row._id.day).padStart(2, '0')}`),
        data: dailyRows.map((row) => Math.round(row.total || 0))
    };

    response.charts.topTests = {
        labels: topTestRows.map((row) => row._id),
        data: topTestRows.map((row) => row.count)
    };

    // Add franchisees data
    response.franchisees = franchisees;

    return res.status(200).json(response);
});

const updatebookingstatus = asyncHandler(async (req, res) => {

    const { barcode, status, bookingId } = req.body;
    const tenantId = req.user.tenantId._id;

    // Check if barcode already exists
    const existingBarcode = await acceptedBarcode.findOne({
        tenantId,
        "barcodes.barcode": barcode.barcode, // Check if barcode exists in any document
        status: { $ne: "cancelled" }
    }).select("_id").lean();

    if (existingBarcode) {
        console.log("booking already present");
        return res.status(400).json({ message: "This barcode is already accepted." });
    }


    await acceptedBarcode.updateOne(
        {
            tenantId,
            bookingId
        },
        {
            $setOnInsert: {
                tenantId,
                bookingId
            },
            $addToSet: { barcodes: barcode }
        },
        { upsert: true }
    );

    let updatedStatus;

    if (status == "pending") {
        updatedStatus = await newBooking.findOneAndUpdate(
            {
                tenantId,
                bookingId
            },
            { status },
            { new: true }
        ).select("patientName bookingId")
    }

    if (!updatedStatus) {
        return res.status(400).json({ message: "booking no accepted, please try again" });
        // throw new Error("status not updated");
    }

    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "other",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: `${req.user.fullName} accepted barcode samples`,
                        bookingName: updatedStatus.patientName,
                        sample: barcode,
                        bookingId: updatedStatus.bookingId,
                    },
                    reference: {
                        model: "Booking",
                        id: updatedStatus._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.status(200).json({ message: "this barcode sample accepted and booking status updated" });
})

const rejectBookingcontroller = async (req, res) => {
    const { bookingId } = req.body;
    const tenantId = req.user.tenantId._id;

    let userRole;
    if (req.user.role === "staff") {
        userRole = req.user.parentRole
    } else {
        userRole = req.user.role
    }
    // 1️⃣ Booking cancel करना
    const updatedStatus = await newBooking.findOneAndUpdate(
        {
            tenantId,
            bookingId
        },
        {
            status: "cancelled",
            isreportready: false
        },
        { new: true }
    ).select("patientName bookingId createdBy total");

    if (userRole !== "admin") {
        if (!updatedStatus) {
            throw new Error("Booking status not updated");
        }

        // 2️⃣ User ढूंढना
        const user = await User.findById(updatedStatus.createdBy).select("_id").lean();

        if (!user) {
            throw new Error("User not found");
        }

        // 3️⃣ Wallet amount जोड़ना
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            {
                $inc: { bookingWallet: Number(updatedStatus.total) }
            },
            { new: true }
        );

        if (!updatedUser) {
            throw new Error("Refund not initiated");
        }
    }

    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "booking_cancellation",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: `${req.user.fullName} reject booking status`,
                        bookingName: updatedStatus.patientName,
                        bookingId: updatedStatus.bookingId,

                    },
                    reference: {
                        model: "Booking",
                        id: updatedStatus._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    // 4️⃣ Success response
    return res.status(200).json({ message: "Booking cancelled successfully, Refund initiated" });
};

const CompleteBookingcontroller = async (req, res) => {
    const { bookingid } = req.body;

    const updatedStatus = await newBooking.findOneAndUpdate(
        { bookingId: bookingid },
        {
            status: "completed",
            isreportready: true
        },
        { new: true }
    )
    // console.log("updated: ", updatedStatus);

    if (!updatedStatus) {
        throw new Error("status not updated");
    }

    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "other",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: `${req.user.fullName} completed bookings status`,
                        bookingName: updatedStatus.patientName,
                        bookingId: updatedStatus.bookingId,
                    },
                    reference: {
                        model: "Booking",
                        id: updatedStatus._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.status(200).json({ message: "booking status updated successfully" });
}

const statusBookingcontroller = async (req, res) => {
    const { bookingid, status } = req.body;
    const updatedStatus = await newBooking.findOneAndUpdate(
        { bookingId: bookingid },
        {
            status: status,
        },
        { new: true }
    )
    // console.log("updated: ", updatedStatus);

    if (!updatedStatus) {
        throw new Error("status not updated");
    }

    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "booking_updated",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: `${req.user.fullName} updated booking ${status}`,
                        bookingName: updatedStatus.patientName,
                        bookingId: updatedStatus.bookingId,

                    },
                    reference: {
                        model: "Booking",
                        id: updatedStatus._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }
    return res.status(200).json({ message: "booking status updated successfully" });
}

const deleteBarcode = asyncHandler(async (req, res) => {
    const { barcodeId } = req.body;
    const tenantId = req.user.tenantId._id;

    if (!barcodeId) {
        return res.status(400).json({ error: "barcodeId and bookingId are required" });
    }

    const savedBarcode = await acceptedBarcode.findOne(
        {
            tenantId,
            "barcodes.barcode": barcodeId,
            status: { $ne: "cancelled" }
        }
    ).select("_id bookingId barcodes").lean();

    if (!savedBarcode) {
        return res.status(404).json({ message: "this barcode is not recieved" });
    }

    const barcodeExists = savedBarcode.barcodes?.some(barcode => barcode.barcode === barcodeId);
    if (!barcodeExists) {
        return res.status(404).json({ error: "Barcode not found" });
    }

    const updatedDocument = await acceptedBarcode.findByIdAndUpdate(
        savedBarcode._id,
        { $pull: { barcodes: { barcode: barcodeId } } },
        { new: true }
    );

    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "other",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: `${req.user.fullName} Deleted Barcode`,
                        barcodeId: barcodeId,

                    },
                    reference: {
                        model: "Booking",
                        id: savedBarcode._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.status(200).json({ message: "this Barcode sample deleted successfully", updatedDocument });
});

const getbarcodebooking = asyncHandler(async (req, res) => {
    const { barcodeId } = req.body;
    const tid = req.user.tenantId._id;

    const data = await getbarcodetestsandpanels(tid, barcodeId);

    return res.status(200).json(data);
})
async function getbarcodetestsandpanels(tid, barcodeId) {
    console.log("tid:", tid);
    console.log("barcodeId:", barcodeId);

    const barcodeBooking = await newBooking.findOne(
        {
            tenantId: tid,
            "tableData.barcodeId": barcodeId,
            status: { $ne: "cancelled" }
        }
    )

    if (!barcodeBooking) {
        throw new Error("booking not found");
    }

    if (barcodeBooking.status == "cancelled") {
        throw new Error("this booking is already cancelled");
    }

    // Check tableData
    if (!barcodeBooking.tableData || barcodeBooking.tableData.length === 0) {
        throw new Error("No table data found for this booking");
    }

    const barcodeobject = barcodeBooking.tableData.find(item => item.barcodeId === barcodeId);

    if (!barcodeobject) {
        throw new Error("Barcode not found in this booking");
    }

    const ids = Array.isArray(barcodeobject.ids) ? barcodeobject.ids : [];
    const uniqueIdsByCollection = ids.reduce((acc, obj) => {
        if (!obj?.id || !obj?.collectionName) {
            return acc;
        }

        const collectionName = obj.collectionName;
        if (!acc[collectionName]) {
            acc[collectionName] = new Set();
        }

        acc[collectionName].add(obj.id.toString());
        return acc;
    }, {});

    const toObjectIds = (values = []) =>
        values
            .filter((value) => mongoose.Types.ObjectId.isValid(value))
            .map((value) => new mongoose.Types.ObjectId(value));

    const [tests, panels, packages] = await Promise.all([
        uniqueIdsByCollection.testSchema?.size
            ? testSchema.find({ _id: { $in: toObjectIds([...uniqueIdsByCollection.testSchema]) } })
                .select("Name")
                .lean()
            : [],
        uniqueIdsByCollection.addPannel?.size
            ? addPannel.find({ _id: { $in: toObjectIds([...uniqueIdsByCollection.addPannel]) } })
                .select("name")
                .lean()
            : [],
        uniqueIdsByCollection.Package?.size
            ? Package.find({ _id: { $in: toObjectIds([...uniqueIdsByCollection.Package]) } })
                .select("testIds pannelIds")
                .populate("testIds", "Name sampleType")
                .populate("pannelIds", "name sample_types")
                .lean()
            : []
    ]);

    const directTestsMap = new Map(tests.map((doc) => [doc._id.toString(), doc]));
    const directPanelsMap = new Map(panels.map((doc) => [doc._id.toString(), doc]));
    const sampleType = barcodeobject.typeOfSample;
    const allNames = [];
    const testObjectsMap = new Map();

    const appendUniqueResult = (id, collectionName, name) => {
        if (!id || !name) {
            return;
        }

        allNames.push(name);
        const key = `${id}_${collectionName}`;
        if (!testObjectsMap.has(key)) {
            testObjectsMap.set(key, { id, collectionName });
        }
    };

    for (const obj of ids) {
        if (!obj?.id || !obj?.collectionName) {
            continue;
        }

        const id = obj.id.toString();

        if (obj.collectionName === "testSchema") {
            const doc = directTestsMap.get(id);
            if (doc?.Name) {
                appendUniqueResult(doc._id, "testSchema", doc.Name);
            }
            continue;
        }

        if (obj.collectionName === "addPannel") {
            const doc = directPanelsMap.get(id);
            if (doc?.name) {
                appendUniqueResult(doc._id, "addPannel", doc.name);
            }
        }
    }

    for (const doc of packages) {
        if (!doc) continue;

        const addedTestIds = new Set();
        const addedPanelIds = new Set();

        for (const test of doc.testIds || []) {
            if (!test?._id || test.sampleType !== sampleType) continue;

            const testId = test._id.toString();
            if (addedTestIds.has(testId)) continue;

            addedTestIds.add(testId);
            appendUniqueResult(test._id, "testSchema", test.Name);
        }

        for (const panel of doc.pannelIds || []) {
            if (!panel?._id || !Array.isArray(panel.sample_types) || !panel.sample_types.includes(sampleType)) continue;

            const panelId = panel._id.toString();
            if (addedPanelIds.has(panelId)) continue;

            addedPanelIds.add(panelId);
            appendUniqueResult(panel._id, "addPannel", panel.name);
        }
    }

    const testnames = [...new Set(allNames)];
    const testObjects = Array.from(testObjectsMap.values());

    return {
        booking: barcodeBooking,
        bookedtest: barcodeobject.testName,
        message: "barcode bookings retrieved successfully",
        sampletype: barcodeobject.typeOfSample,
        testandpannels: testnames,
        testIds: testObjects,
        barcodeobject
    };
}

const getbarcodetestsandpannels = asyncHandler(async (req, res) => {

    const { barcodeId, tests, sampletype, bookingId } = req.body;

    const barcode = await getBarcodeTestsAndPanelsCore({
        barcodeId,
        tests,
        sampletype
    });

    return res.status(200).json(barcode);
})

async function getBarcodeTestsAndPanelsCore({ barcodeId, tests, sampletype }) {
    const barcode = {};
    const testandpannelArray = [];

    console.log("this is barcodeId", barcodeId, "that is testnames", tests, "sampletype", sampletype);

    if (tests) {
        // let testArray = tests;
        if (tests.includes(",")) {
            let testArray = tests.split(',');
            for (let element of testArray) {
                const testAndPannels = await Package.findOne(
                    { packageName: element },
                    { pannelname: 1, testname: 1, _id: 0 }
                )
                console.log("testAndPannels", testAndPannels);
                if (testAndPannels) {
                    const testsaddedPannels = [...(testAndPannels?.pannelname), ...(testAndPannels?.testname)];
                    for (const tap of testsaddedPannels) {
                        // Check if it's a single test
                        const singleTest = await testSchema.findOne({ Name: tap, sampleType: sampletype });
                        if (singleTest) {
                            testandpannelArray.push(singleTest.Name);
                            continue; // Move to the next item in the loop
                        }

                        // Check if it's a panel
                        const panel = await addPannel.findOne({ name: tap, sample_types: sampletype });
                        if (panel) {
                            testandpannelArray.push(panel.name);
                            continue;
                        }
                    }
                } else {
                    // Check if it's a single test
                    const singleTest = await testSchema.findOne({ Name: element });
                    if (singleTest) {
                        testandpannelArray.push(singleTest.Name);
                    }

                    // Check if it's a panel
                    const panel = await addPannel.findOne({ name: element });
                    if (panel) {
                        testandpannelArray.push(panel.name);
                    }
                }
            };
        } else {
            const testAndPannels = await Package.findOne(
                { packageName: tests },
                { pannelname: 1, testname: 1, _id: 0 }
            )
            console.log("testAndPannels", testAndPannels);

            if (testAndPannels) {
                const testsaddedPannels = [...(testAndPannels?.pannelname), ...(testAndPannels?.testname)];
                for (const tap of testsaddedPannels) {
                    // Check if it's a single test
                    const singleTest = await testSchema.findOne({ Name: tap, sampleType: sampletype });
                    if (singleTest) {
                        testandpannelArray.push(singleTest.Name);
                        continue; // Move to the next item in the loop
                    }

                    // Check if it's a panel
                    const panel = await addPannel.findOne({ name: tap, sample_types: sampletype });
                    if (panel) {
                        testandpannelArray.push(panel.name);
                        continue;
                    }
                }
            } else {
                // Check if it's a single test
                const singleTest = await testSchema.findOne({ Name: tests });
                if (singleTest) {
                    testandpannelArray.push(singleTest.Name);
                }

                // Check if it's a panel
                const panel = await addPannel.findOne({ name: tests });
                if (panel) {
                    testandpannelArray.push(panel.name);
                }
            }
        }
    }

    barcode.barcode = barcodeId;
    barcode.sampleType = sampletype;
    barcode.testandpannelArray = testandpannelArray;

    return barcode;
}

const bookingreportgenOrnot = asyncHandler(async (req, res) => {
    const { bookingid } = req.body

    const updatedisreportready = await newBooking.findOneAndUpdate(
        { bookingId: bookingid }, { isreportready: true }, { new: true }
    )

    if (!updatedisreportready) {
        throw new Error("isreportready not updated");
    }
    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "booking_updated",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: `${req.user.fullName} Marked report as ready`,
                        bookingName: updatedisreportready.patientName,
                        bookingId: updatedisreportready.bookingId,

                    },
                    reference: {
                        model: "Booking",
                        id: updatedisreportready._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.status(200).json(new ApiResponse(200, updatedisreportready, "updated isreportready successfully"));
})

const getthirtydayspreviousBookingsController = asyncHandler(async (req, res) => {
    // Calculate the date 30 days ago from today
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Retrieve bookings from the last 30 days, sorted by 'createdAt' in descending order
    const bookings = await newBooking.find({
        createdAt: { $gte: thirtyDaysAgo }
    }).sort({ createdAt: -1 });

    if (!bookings || bookings.length === 0) {
        throw new ApiError(404, "No bookings found in the last 30 days");
    }

    return res.status(200).json(new ApiResponse(200, bookings, "Bookings from the last 30 days retrieved successfully"));
});

const getTestNameController = async (req, res) => {
    const { bookingId } = req.body;
    const tid = req.user.tenantId._id;

    try {
        const barcodes = await acceptedBarcode.findOne({
            tenantId: tid,
            bookingId
        }).select("bookingId createdAt barcodes").lean();

        if (!barcodes) {
            return res.status(404).json({ message: "No test and panels found for this booking ID." });
        }

        const normalizeObjectIds = (ids = []) => {
            const seen = new Set();
            const normalized = [];

            for (const id of ids) {
                if (!id) continue;

                const idString = id.toString();
                if (seen.has(idString) || !mongoose.Types.ObjectId.isValid(idString)) continue;

                seen.add(idString);
                normalized.push(new mongoose.Types.ObjectId(idString));
            }

            return normalized;
        };

        const buildLookupMap = (docs = [], alternateKey) => {
            const map = new Map();

            docs.forEach((doc) => {
                if (!doc?._id) return;

                map.set(doc._id.toString(), doc);

                if (alternateKey && doc[alternateKey]) {
                    map.set(doc[alternateKey].toString(), doc);
                }
            });

            return map;
        };

        const attachLatestCategory = async (items = []) => {
            const categoryIds = normalizeObjectIds(
                items.map((item) => item?.category?._id).filter(Boolean)
            );

            if (categoryIds.length === 0) {
                return items;
            }

            const categories = await categorydb.find({
                _id: { $in: categoryIds },
                tenantId: tid
            }).lean();

            const categoryMap = new Map(categories.map((category) => [category._id.toString(), category]));

            return items.map((item) => ({
                ...item,
                category: categoryMap.get(item?.category?._id?.toString()) || item.category
            }));
        };

        const barcodeEntries = Array.isArray(barcodes.barcodes) ? barcodes.barcodes : [];
        const directTestIds = [];
        const directPanelIds = [];
        const packageIds = [];

        barcodeEntries.forEach((barcode) => {
            (barcode.testIds || []).forEach((item) => {
                if (!item?.id) return;

                if (item.collectionName === "testSchema") directTestIds.push(item.id);
                if (item.collectionName === "addPannel") directPanelIds.push(item.id);
                if (item.collectionName === "Package") packageIds.push(item.id);
            });
        });

        const directTestObjectIds = normalizeObjectIds(directTestIds);
        const directPanelObjectIds = normalizeObjectIds(directPanelIds);
        const packageObjectIds = normalizeObjectIds(packageIds);

        const [directTests, directPanelsRaw, packageDocs] = await Promise.all([
            directTestObjectIds.length
                ? testSchema.find({
                    tenantId: tid,
                    $or: [
                        { _id: { $in: directTestObjectIds } },
                        { originalTestId: { $in: directTestObjectIds } }
                    ]
                }).select(LAB_REPORT_TEST_SELECT).lean()
                : Promise.resolve([]),
            directPanelObjectIds.length
                ? addPannel.find({
                    tenantId: tid,
                    $or: [
                        { _id: { $in: directPanelObjectIds } },
                        { originalPanelId: { $in: directPanelObjectIds } }
                    ]
                }).select(LAB_REPORT_PANEL_SELECT).lean()
                : Promise.resolve([]),
            packageObjectIds.length
                ? Package.find({
                    tenantId: tid,
                    $or: [
                        { _id: { $in: packageObjectIds } },
                        { originalPackageId: { $in: packageObjectIds } }
                    ]
                }).select("testIds pannelIds originalPackageId").lean()
                : Promise.resolve([])
        ]);

        const packageTestObjectIds = normalizeObjectIds(packageDocs.flatMap((pkg) => pkg.testIds || []));
        const packagePanelObjectIds = normalizeObjectIds(packageDocs.flatMap((pkg) => pkg.pannelIds || []));

        const [packageTestsRaw, packagePanelsRaw] = await Promise.all([
            packageTestObjectIds.length
                ? testSchema.find({
                    tenantId: tid,
                    $or: [
                        { _id: { $in: packageTestObjectIds } },
                        { originalTestId: { $in: packageTestObjectIds } }
                    ]
                }).select(LAB_REPORT_TEST_SELECT).lean()
                : Promise.resolve([]),
            packagePanelObjectIds.length
                ? addPannel.find({
                    tenantId: tid,
                    $or: [
                        { _id: { $in: packagePanelObjectIds } },
                        { originalPanelId: { $in: packagePanelObjectIds } }
                    ]
                }).select(LAB_REPORT_PANEL_SELECT).lean()
                : Promise.resolve([])
        ]);

        const allTestsMap = buildLookupMap([...directTests, ...packageTestsRaw], "originalTestId");
        const allPanelsMap = buildLookupMap([...directPanelsRaw, ...packagePanelsRaw], "originalPanelId");
        const packageMap = buildLookupMap(packageDocs, "originalPackageId");

        const nestedPanelTestObjectIds = normalizeObjectIds(
            [...directPanelsRaw, ...packagePanelsRaw].flatMap((panel) => panel.testsId || [])
        );

        const nestedPanelTests = nestedPanelTestObjectIds.length
            ? await testSchema.find({
                tenantId: tid,
                $or: [
                    { _id: { $in: nestedPanelTestObjectIds } },
                    { originalTestId: { $in: nestedPanelTestObjectIds } }
                ]
            }).select(LAB_REPORT_TEST_SELECT).lean()
            : [];

        const nestedPanelTestsMap = buildLookupMap(nestedPanelTests, "originalTestId");

        const hydratePanel = (panel) => {
            if (!panel) return null;

            return {
                ...panel,
                testsId: (panel.testsId || [])
                    .map((testId) => nestedPanelTestsMap.get(testId.toString()))
                    .filter(Boolean)
            };
        };

        const processedTests = new Set();
        const processedPanels = new Set();
        const processedPackages = new Set();
        const singleTests = [];
        const panels = [];

        const addSingleTest = (test) => {
            if (!test?._id) return;

            const key = test._id.toString();
            if (processedTests.has(key)) return;

            processedTests.add(key);
            singleTests.push(test);
        };

        const addPanel = (panel) => {
            if (!panel?._id) return;

            const key = panel._id.toString();
            if (processedPanels.has(key)) return;

            processedPanels.add(key);
            panels.push(hydratePanel(panel));
        };

        barcodeEntries.forEach((barcode) => {
            (barcode.testIds || []).forEach((item) => {
                if (!item?.id) return;

                const itemKey = item.id.toString();

                if (item.collectionName === "testSchema") {
                    addSingleTest(allTestsMap.get(itemKey));
                    return;
                }

                if (item.collectionName === "addPannel") {
                    addPanel(allPanelsMap.get(itemKey));
                    return;
                }

                if (item.collectionName !== "Package") return;

                const packageProcessKey = `${itemKey}_${barcode.typeOfSample || ""}`;
                if (processedPackages.has(packageProcessKey)) return;

                processedPackages.add(packageProcessKey);

                const matchedPackage = packageMap.get(itemKey);
                if (!matchedPackage) return;

                (matchedPackage.testIds || []).forEach((testId) => {
                    const testDoc = allTestsMap.get(testId.toString());
                    if (!testDoc) return;
                    if (!barcode.typeOfSample || testDoc.sampleType === barcode.typeOfSample) {
                        addSingleTest(testDoc);
                    }
                });

                (matchedPackage.pannelIds || []).forEach((panelId) => {
                    const panelDoc = allPanelsMap.get(panelId.toString());
                    if (!panelDoc) return;
                    if (!barcode.typeOfSample || (panelDoc.sample_types || []).includes(barcode.typeOfSample)) {
                        addPanel(panelDoc);
                    }
                });
            });
        });

        const [singleTestsWithCategory, panelsWithCategory] = await Promise.all([
            attachLatestCategory(singleTests),
            attachLatestCategory(panels)
        ]);

        return res.status(200).json([{
            barcodes,
            singleTests: singleTestsWithCategory,
            panels: panelsWithCategory
        }]);
    } catch (error) {
        console.error("Error fetching barcodes:", error.message);
        return res.status(500).json({ message: "Internal server error." });
    }
};

const getTestNameControllerLegacy = async (req, res) => {
    const { bookingId } = req.body;
    const tid = req.user.tenantId._id;

    // ✅ Declare tracking Sets
    const processedPackages = new Set();
    const processedTests = new Set();
    const processedPanels = new Set();

    try {
        console.log("Received bookingId:", bookingId);

        const barcodes = await acceptedBarcode.findOne({
            tenantId: tid,
            bookingId: bookingId
        });

        if (!barcodes) {
            console.log("no barcodes found");
            return res.status(404).json({ message: "No test and panels found for this booking ID." });
        }

        const barcodeResults = await Promise.all(
            barcodes.barcodes.map(async (element) => {
                const array = await Promise.all(
                    element.testIds.map(async (obj) => {
                        // ✅ Handle Test
                        if (obj.collectionName === "testSchema") {
                            const testKey = obj.id.toString();
                            if (processedTests.has(testKey)) {
                                return { singleTests: [], panels: [] };
                            }
                            processedTests.add(testKey);

                            // ✅ Find test by _id OR originalTestId + tenantId compulsory
                            const docs = await testSchema.find({
                                $or: [
                                    { _id: obj.id },
                                    { originalTestId: obj.id }
                                ],
                                tenantId: tid
                            });

                            return { singleTests: docs, panels: [] };
                        }

                        // ✅ Handle Panel
                        if (obj.collectionName === "addPannel") {
                            const panelKey = obj.id.toString();
                            if (processedPanels.has(panelKey)) {
                                return { singleTests: [], panels: [] };
                            }
                            processedPanels.add(panelKey);

                            // ✅ Find panel by _id OR originalPanelId + tenantId compulsory
                            const docs = await addPannel.find({
                                $or: [
                                    { _id: obj.id },
                                    { originalPanelId: obj.id }
                                ],
                                tenantId: tid
                            }).populate({
                                path: 'testsId',
                                match: {
                                    $or: [
                                        { _id: { $exists: true } },
                                        { originalTestId: { $exists: true } }
                                    ],
                                    tenantId: tid
                                }
                            });

                            return { singleTests: [], panels: docs };
                        }

                        // ✅ Handle Package
                        if (obj.collectionName === "Package") {
                            const packageKey = `${obj.id}_${element.typeOfSample}`;
                            if (processedPackages.has(packageKey)) {
                                return { singleTests: [], panels: [] };
                            }
                            processedPackages.add(packageKey);

                            // ✅ Find package by _id OR originalPackageId + tenantId
                            const doc = await Package.findOne({
                                $or: [
                                    { _id: obj.id },
                                    { originalPackageId: obj.id }
                                ],
                                tenantId: tid
                            })
                                .select('testIds pannelIds')
                                .populate({
                                    path: 'testIds',
                                    match: {
                                        $or: [
                                            { _id: { $exists: true } },
                                            { originalTestId: { $exists: true } }
                                        ],
                                        tenantId: tid
                                    }
                                })
                                .populate({
                                    path: 'pannelIds',
                                    match: {
                                        $or: [
                                            { _id: { $exists: true } },
                                            { originalPanelId: { $exists: true } }
                                        ],
                                        tenantId: tid
                                    }
                                });

                            if (!doc) return { singleTests: [], panels: [] };

                            const packageTestIds = [];
                            const packagePanelIds = [];

                            // ✅ Filter tests based on sample type
                            doc.testIds?.forEach(test => {
                                if (test && test.sampleType === element.typeOfSample) {
                                    const testKey = test._id.toString();
                                    if (!processedTests.has(testKey)) {
                                        processedTests.add(testKey);
                                        packageTestIds.push(test._id);
                                    }
                                }
                            });

                            // ✅ Filter panels based on sample type
                            doc.pannelIds?.forEach(panel => {
                                if (panel && panel.sample_types?.[0] === element.typeOfSample) {
                                    const panelKey = panel._id.toString();
                                    if (!processedPanels.has(panelKey)) {
                                        processedPanels.add(panelKey);
                                        packagePanelIds.push(panel._id);
                                    }
                                }
                            });

                            // ✅ Fetch full test documents with condition
                            const packageTests = await testSchema.find({
                                $or: [
                                    { _id: { $in: packageTestIds } },
                                    { originalTestId: { $in: packageTestIds } }
                                ],
                                tenantId: tid
                            });

                            // ✅ Fetch full panel documents with populated tests
                            const packagePanels = await addPannel.find({
                                $or: [
                                    { _id: { $in: packagePanelIds } },
                                    { originalPanelId: { $in: packagePanelIds } }
                                ],
                                tenantId: tid
                            }).populate({
                                path: 'testsId',
                                match: {
                                    $or: [
                                        { _id: { $exists: true } },
                                        { originalTestId: { $exists: true } }
                                    ],
                                    tenantId: tid
                                }
                            });

                            return { singleTests: packageTests, panels: packagePanels };
                        }

                        return { singleTests: [], panels: [] };
                    })
                );
                const attachLatestCategory = async (tests, tid) => {
                    const categoryIds = [
                        ...new Set(
                            tests
                                .map(t => t.category?._id)
                                .filter(Boolean)
                                .map(id => id.toString())
                        )
                    ];

                    const categories = await categorydb.find({
                        _id: { $in: categoryIds },
                        tenantId: tid
                    });

                    const categoryMap = new Map(
                        categories.map(cat => [cat._id.toString(), cat])
                    );

                    return tests.map(test => ({
                        ...test._doc,
                        category: categoryMap.get(test.category?._id?.toString()) || test.category
                    }));
                };
                // ✅ Flatten results
                let singleTests = array.flatMap(r => r.singleTests);

                singleTests = await attachLatestCategory(singleTests, tid);
                let panels = array.flatMap(r => r.panels);
                panels = await attachLatestCategory(panels, tid);

                return { barcodes, singleTests, panels };
            })
        );

        // ✅ Merge all barcode results
        const mergedResult = barcodeResults.reduce(
            (acc, curr, index) => {
                if (index === 0) {
                    acc.barcodes = curr.barcodes;
                }
                acc.singleTests = [...acc.singleTests, ...curr.singleTests];
                acc.panels = [...acc.panels, ...curr.panels];
                return acc;
            },
            { barcodes: {}, singleTests: [], panels: [] }
        );

        return res.status(200).json([mergedResult]);
    } catch (error) {
        console.error("Error fetching barcodes:", error.message);
        return res.status(500).json({ message: "Internal server error." });
    }
};

const getallbarcodesController = async (req, res) => {

    try {

        // Find barcodes by bookingId
        const barcodes = await acceptedBarcode.find({});

        // Handle case when no data is found
        if (!barcodes) {
            console.log("no barcodes found")
            return res.status(404).json({ message: "No test and panels found for this booking ID." });
        }

        // Return data if found
        return res.status(200).json(barcodes);
    } catch (error) {
        // Handle server errors
        console.error("Error fetching barcodes:", error.message);
        return res.status(500).json({ message: "Internal server error." });
    }
};
// GET: Fetch bookings
const loadBooking = asyncHandler(async (req, res) => {
    try {
        const { status, startDate, endDate, franchiseeId } = req.query;
        const userId = req.user._id;
        console.log('Query params:', { userId, status, startDate, endDate, franchiseeId });

        const query = {};

        // ✅ Handle franchiseeId first (priority over userId)
        if (franchiseeId) {
            query.createdBy = franchiseeId;
        } else if (userId) {
            query.createdBy = userId;
        }

        // ✅ Add status filter
        if (status) {
            query.status = status;
        }

        // ✅ Add tenant filter
        query.tenantId = req.user.tenantId._id;

        // ✅ Handle date range filter
        if (startDate || endDate) {
            query.createdAt = {};

            if (startDate) {
                const parsedStartDate = new Date(startDate);
                if (isNaN(parsedStartDate)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid start date format'
                    });
                }
                // Set to start of day (00:00:00)
                parsedStartDate.setHours(0, 0, 0, 0);
                query.createdAt.$gte = parsedStartDate;
            }

            if (endDate) {
                const parsedEndDate = new Date(endDate);
                if (isNaN(parsedEndDate)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid end date format'
                    });
                }
                // Set to end of day (23:59:59.999)
                parsedEndDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = parsedEndDate;
            }
        } else {
            // ✅ Default to last 24 hours if no dates provided
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            query.createdAt = {
                $gte: yesterday,
                $lte: now
            };
        }

        console.log('Final query:', JSON.stringify(query, null, 2));

        // Fetch bookings from database
        const bookings = await newBooking.find(query)
            .select(BOOKING_LIST_PROJECTION)
            .populate('createdBy', 'fullName')
            .sort({ createdAt: -1 }) // ✅ Most recent first
            .lean();

        // ✅ Return consistent response format
        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });

    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bookings',
            message: error.message
        });
    }
});

const loadAllBooking = asyncHandler(async (req, res) => {
    try {
        const { userId, franchiseeId, startDate, endDate } = req.query;
        const query = {};

        // ✅ Handle userId and franchiseeId properly
        if (franchiseeId) {
            query.createdBy = franchiseeId;
        } else if (userId) {
            query.createdBy = userId;
        }

        query.tenantId = req.user.tenantId._id;

        // ✅ Add date filter
        if (startDate || endDate) {
            query.createdAt = {};

            if (startDate) {
                // Start of the day (00:00:00)
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.createdAt.$gte = start;
            }

            if (endDate) {
                // End of the day (23:59:59)
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        // Fetch bookings from database
        const bookings = await newBooking.find(query)
            .select(BOOKING_LIST_PROJECTION)
            .populate('createdBy', 'fullName')
            .sort({ createdAt: -1 }) // ✅ Most recent first
            .lean();

        // ✅ Return consistent response format
        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });

    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bookings',
            message: error.message
        });
    }
});

const getBookingcontroller = async (req, res) => {
    const { value1 } = req.body;
    const tid = req.user.tenantId._id;

    if (!value1) {
        return res.status(500).json({ message: "something went wrong retry later" });
    }

    const booking = await newBooking.findOne({
        tenantId: tid,
        status: { $ne: "cancelled" },
        bookingId: value1
    }).lean();

    if (!booking) {
        return res.status(404).json({ message: "booking not found or cancelled" })
    }

    const acceptedBarcodeDoc = await acceptedBarcode.findOne(
        { tenantId: tid, bookingId: value1 },
        { barcodes: 1 }
    ).lean();

    booking.acceptedbarcode = (acceptedBarcodeDoc?.barcodes || [])
        .map((item) => item?.barcode)
        .filter(Boolean);

    return res.status(200).json(booking);
}

const editBookingController = async (req, res) => {
    try {
        const {
            bookingId, date, time, courierName, courierId, patientName,
            year, gender, patientPhone, doctorName, labName, franchisee,
            clinicalHistory, subFranchisee, savedDoctor, savedLab
        } = req.body;

        let { subFranchiseeId, savedDoctorId, savedLabId } = req.body;

        // ✅ Validate and clean ObjectIds
        const isValidObjectId = (id) => {
            if (!id || id === "null" || id === "undefined") return false;
            return /^[0-9a-fA-F]{24}$/.test(id);
        };

        subFranchiseeId = isValidObjectId(subFranchiseeId) ? subFranchiseeId : null;
        savedDoctorId = isValidObjectId(savedDoctorId) ? savedDoctorId : null;
        savedLabId = isValidObjectId(savedLabId) ? savedLabId : null;

        // 🔍 Pehle purani booking lao
        const booking = await newBooking.findOne({ bookingId });
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        let filelink;
        if (req.files && req.files.file && req.files.file.length > 0) {
            const uploadableFilepath = req.files.file[0].path;
            filelink = await uploadOnCloudinary(uploadableFilepath);
        }

        // 🆕 New values object
        const updates = {
            courierName,
            courierId,
            patientName,
            date,
            time,
            year,
            gender,
            patientPhone,
            doctorName,
            labName,
            franchisee,
            clinicalHistory,
            file: filelink?.url ?? booking.file,
            subFranchisee: subFranchisee || "",
            subFranchiseeId,
            savedDoctor: savedDoctor || "",
            savedDoctorId,
            savedLab: savedLab || "",
            savedLabId
        };

        // 🧠 CHANGE TRACKING LOGIC with proper comparison
        let historyLogs = [];

        Object.keys(updates).forEach((field) => {
            let oldValue = booking[field];
            let newValue = updates[field];

            // ✅ Skip null/undefined checks - normalize
            if (oldValue === null || oldValue === undefined) oldValue = "";
            if (newValue === null || newValue === undefined) newValue = "";

            // ✅ Special handling for Date field
            if (field === 'date') {
                // Convert both to YYYY-MM-DD format for comparison
                const oldDate = oldValue ? new Date(oldValue).toISOString().split('T')[0] : "";
                const newDate = newValue ? new Date(newValue).toISOString().split('T')[0] : "";

                if (oldDate === newDate) {
                    return; // Skip if dates are same
                }

                // Store actual Date objects for history
                oldValue = oldValue ? new Date(oldValue) : "";
                newValue = newValue ? new Date(newValue) : "";
            }

            // ✅ Special handling for ObjectId fields
            else if (field === 'subFranchiseeId' || field === 'savedDoctorId' || field === 'savedLabId') {
                // Convert to string for comparison
                const oldId = oldValue ? oldValue.toString() : "";
                const newId = newValue ? newValue.toString() : "";

                if (oldId === newId) {
                    return; // Skip if IDs are same
                }
            }

            // ✅ String fields - trim and normalize
            else if (typeof oldValue === 'string' && typeof newValue === 'string') {
                oldValue = oldValue.trim();
                newValue = newValue.trim();

                if (oldValue === newValue) {
                    return; // Skip if strings are same
                }
            }

            // ✅ General comparison for other fields
            else {
                if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
                    return; // Skip if values are same
                }
            }

            // 📝 Log the change
            historyLogs.push({
                fieldName: field,
                oldValue: booking[field], // Store original value from DB
                newValue: updates[field],  // Store new value from request
                editedById: req.user._id,
                editedByName: req.user.fullName,
                editedAt: new Date()
            });

            booking[field] = updates[field]; // apply change
        });

        // 📝 History push only if changes exist
        if (historyLogs.length > 0) {
            booking.editHistory.push(...historyLogs);
        }

        await booking.save();

        // 🔔 Activity log (staff case)
        if (req.user.role === 'staff' && historyLogs.length > 0) {
            await User.findByIdAndUpdate(req.user._id, {
                $push: {
                    activities: {
                        activityType: "booking_updated",
                        details: {
                            staffId: req.user._id,
                            staffName: req.user.fullName,
                            action: `${req.user.fullName} edited booking fields.`,
                            bookingName: booking.patientName,
                            bookingId: booking.bookingId,
                        },
                        reference: {
                            model: "Booking",
                            id: booking._id
                        },
                        timestamp: new Date()
                    }
                }
            });
        }

        return res.status(200).json({
            message: historyLogs.length > 0 ? "Booking updated successfully" : "No changes detected",
            data: booking,
            changesTracked: historyLogs.length
        });

    } catch (error) {
        console.error("Edit booking error:", error);
        return res.status(500).json({ message: "Server error while updating booking" });
    }
};

const searchit = asyncHandler(async (req, res) => {
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }
    const search = req.query.search || ''; // Extract 'search' from the query
    try {
        // Use a regex for flexible search
        const bookings = await newBooking.find({
            $and: [
                { createdBy: userId },
                { tenantId: req.user.tenantId._id },
                {
                    $or: [
                        { bookingId: { $regex: search, $options: 'i' } },
                        { patientName: { $regex: search, $options: 'i' } },
                        { "tableData.barcodeId": { $regex: search, $options: 'i' } }
                    ]
                }
            ]
        });

        res.status(200).json({ bookings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch bookings.' });
    }
});

const updategeneratedbillvariable = async (req, res) => {
    const { bookingid } = req.params;

    // console.log(bookingid);
    const updateddoc = await newBooking.findOneAndUpdate(
        { bookingId: bookingid },
        { billGenerated: true },
        { new: true }
    );

    if (!updateddoc) {
        console.log(updateddoc);
        return res.status(501).json("something went wrong! try again");
    }

    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "other",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: `${req.user.fullName} updated billGenerated to true for a booking`,
                        bookingName: updateddoc.patientName,
                        bookingId: updateddoc.bookingId,

                    },
                    reference: {
                        model: "Booking",
                        id: updateddoc._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.status(200).json(updateddoc);
}

const HoldBookings = asyncHandler(async (req, res) => {
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }
    const tenantId = req.user.tenantId;


    console.log("tenantId:", tenantId._id);
    console.log("createdBy:", userId);

    const HoldBookings = await newBooking.find({
        tenantId: tenantId._id,
        createdBy: userId,
        status: { $in: ["Hold", "clinical"] }
    }).lean();

    if (!HoldBookings || HoldBookings.length === 0) {
        console.log("Hold bookings not found");
        return res.status(200).json(new ApiResponse(200, "empty"));
    }

    // Add messages to each booking
    for (let booking of HoldBookings) {

        const conversation = await Conversation.findOne({
            bookingId: booking.bookingId,
            tenantId: tenantId._id
        });

        if (conversation) {
            console.log("conversation found");

            booking.messages = conversation.messages;
        }
    }

    return res.status(200).json(new ApiResponse(200, HoldBookings, "Hold bookings fetched successfully"));
});

const canceledBookings = asyncHandler(async (req, res) => {
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }

    const tenantId = req.user.tenantId;

    console.log("tenantId:", tenantId._id);
    console.log("createdBy:", userId);

    const HoldBookings = await newBooking.find({
        tenantId: tenantId._id,
        createdBy: userId,
        status: "cancelled"
    }).sort({ createdAt: -1 }).lean();

    if (!HoldBookings || HoldBookings.length === 0) {
        console.log("Hold bookings not found");
        return res.status(200).json(new ApiResponse(200, "empty"));
    }

    // Add messages to each booking
    for (let booking of HoldBookings) {

        const conversation = await Conversation.findOne({
            bookingId: booking.bookingId,
            tenantId: tenantId._id
        });

        if (conversation) {
            console.log("conversation found");

            booking.messages = conversation.messages;
        }
    }

    return res.status(200).json(new ApiResponse(200, HoldBookings, "Hold bookings fetched successfully"));
});

const countBookingsForAllTenants = asyncHandler(async (req, res) => {
    try {
        // Aggregate booking counts and join tenant details
        const bookingCounts = await testSchema.aggregate([
            { $group: { _id: "$tenantId", count: { $sum: 1 } } },
            {
                $lookup: {
                    from: "tenants", // MongoDB collection name (plural, lowercase)
                    localField: "_id",
                    foreignField: "_id",
                    as: "tenantDetails"
                }
            },
            { $unwind: "$tenantDetails" }
        ]);
        res.status(200).json(bookingCounts);
    } catch (error) {
        console.error("Error counting bookings for tenants:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// URL parameter से bookingId लेने के लिए
const DeleteBookingByParamsController = asyncHandler(async (req, res) => {
    try {
        const { bookingId } = req.params;
        const tenantId = req.user.tenantId;
        // Validate bookingId
        if (!bookingId) {
            return res.status(400).json({ message: "Booking ID is required" });
        }

        // Find and delete the booking
        const deletedBooking = await newBooking.findOneAndDelete({
            tenantId: tenantId._id,
            bookingId: bookingId
        });

        if (!deletedBooking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // अगर staff का parentUser है तो उसे भी notify करें
        if (req.user.role === 'staff') {
            await User.findByIdAndUpdate(req.user._id, {
                $push: {
                    activities: {
                        activityType: "booking_deleted",
                        details: {
                            staffId: req.user._id,
                            staffName: req.user.fullName,
                            action: `${req.user.fullName} updated deleted a booking`,
                            bookingName: deletedBooking.patientName,
                            bookingId: bookingId,

                        },
                        reference: {
                            model: "Booking",
                            id: deletedBooking._id
                        },
                        timestamp: new Date()
                    }
                }
            });
        }
        res.status(200).json({
            success: true,
            message: "Booking deleted successfully",
            deletedBooking: deletedBooking
        });

    } catch (err) {
        console.error("Booking deletion failed:", err);
        return res.status(500).json({
            message: "Failed to delete booking",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

const getAllCancelledBookingsController = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const {
        regNo,
        patientName,
        gender,
        patientPhone,
        labName,
        status,
        franchisee,
        barcode
    } = req.body;

    const skip = (page - 1) * limit;

    let query = {
        tenantId: req.user.tenantId._id,
        status: { $in: ["cancelled", "canceled"] }
    };

    // Apply basic filters
    if (regNo) query.bookingId = { $regex: regNo, $options: 'i' };
    if (patientName) query.patientName = { $regex: patientName, $options: 'i' };
    if (gender) query.gender = { $regex: gender, $options: 'i' };
    if (patientPhone) query.patientPhone = { $regex: patientPhone, $options: 'i' };
    if (labName) query.labName = { $regex: labName, $options: 'i' };
    if (status) query.status = { $regex: status, $options: 'i' };
    if (franchisee) query.createdbyuser = { $regex: franchisee, $options: 'i' };

    // Handle barcode filter
    if (barcode) {
        const barcodeDocs = await acceptedBarcode.find(
            { "barcodes.barcode": { $regex: barcode, $options: 'i' } },
            { bookingId: 1 }
        ).lean();

        if (barcodeDocs.length > 0) {
            const bookingIds = barcodeDocs.map(doc => doc.bookingId);
            query.bookingId = { $in: bookingIds };
        } else {
            return res.status(200).json({
                bookings: [],
                total: 0,
                page: parseInt(page),
                limit: parseInt(limit),
            });
        }
    }

    // Fetch bookings with pagination
    const bookings = await newBooking
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

    const total = await newBooking.countDocuments(query);

    // Process barcodes and LIS data for current page bookings
    if (bookings.length > 0) {
        const bookingIds = bookings.map(b => b.bookingId);

        // Fetch barcodes for current page
        const barcodeData = await acceptedBarcode.find(
            { bookingId: { $in: bookingIds } },
            { bookingId: 1, barcodes: 1 }
        ).lean();

        // Create barcode map
        const barcodeMap = new Map();
        const allBarcodeIds = []; // Collect all barcode IDs for LIS check

        barcodeData.forEach(doc => {
            const barcodes = (doc.barcodes || []).map((b) => ({
                barcode: b?.barcode || "",
                sampleType: b?.sampleType || ""
            })).filter((b) => b.barcode);
            barcodeMap.set(doc.bookingId, barcodes);
            allBarcodeIds.push(...barcodes.map((b) => b.barcode));
        });

        // Check LIS data availability for all barcodes in one query
        let lisAvailabilityMap = new Map();

        if (allBarcodeIds.length > 0) {
            const lisDataDocs = await lisdata.find(
                { "lisData.sample_id": { $in: allBarcodeIds } },
                { "lisData.sample_id": 1 }
            ).lean();

            // Create a set of barcodes that have LIS data for O(1) lookup
            const barcodesWithLis = new Set(
                lisDataDocs.map(doc => doc.lisData?.sample_id).filter(Boolean)
            );

            // Map each barcode to its LIS availability
            allBarcodeIds.forEach(barcodeId => {
                lisAvailabilityMap.set(barcodeId, barcodesWithLis.has(barcodeId));
            });
        }

        // Attach barcodes and LIS status to each booking
        bookings.forEach(booking => {
            const bookingBarcodes = barcodeMap.get(booking.bookingId) || [];

            // Create detailed barcode status array
            const barcodeDetails = bookingBarcodes.map(({ barcode, sampleType }) => ({
                barcode,
                sampleType,
                isLisPresent: lisAvailabilityMap.get(barcode) || false
            }));

            // Backward compatibility - keep old format
            booking.acceptedbarcode = bookingBarcodes.map(({ barcode }) => barcode);

            // New detailed format
            booking.barcodeDetails = barcodeDetails;

            // Overall LIS status - true if ANY barcode has LIS data
            booking.isLisPresent = barcodeDetails.length > 0
                ? barcodeDetails.some(detail => detail.isLisPresent === true)
                : false;

            // Additional stats
            booking.lisStats = {
                total: barcodeDetails.length,
                withLis: barcodeDetails.filter(d => d.isLisPresent).length,
                withoutLis: barcodeDetails.filter(d => !d.isLisPresent).length
            };
        });
    }

    return res.status(200).json({
        bookings,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
    });
});

export {
    canceledBookings,
    loadAllBooking,
    loadBooking,
    NewBookingcontroller,
    allBookingsController,
    getAllBookingsController,
    getAdminListBookingsController,
    updatebookingstatus,
    getbarcodebooking,
    bookingreportgenOrnot,
    getthirtydayspreviousBookingsController,
    getbarcodetestsandpannels,
    rejectBookingcontroller,
    deleteBarcode,
    getTestNameController,
    getBookingcontroller,
    editBookingController,
    CompleteBookingcontroller,
    statusBookingcontroller,
    searchit,
    findbookingId,
    getallbarcodesController,
    updategeneratedbillvariable,
    HoldBookings,
    editbookingbookedtests,
    editBookingBarcodes,
    getDashboardDataController,
    countBookingsForAllTenants,
    DeleteBookingByParamsController,
    SearchBookingController,
    cancelBookingController,
    getAllCancelledBookingsController,
    bulkBookingsController
}
