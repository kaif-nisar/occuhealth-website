import puppeteer from "puppeteer";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { newBooking } from "../models/NewBooking.model.js";
import { acceptedBarcode } from "../models/samples.model.js";
import { reports } from "../models/reportData.model.js";
import { testSchema } from "../models/newTest.model.js";
import { addPannel } from "../models/AddPannel.model.js";
import { Package } from "../models/addPackage.model.js";

const AUTO_FINALIZE_ORIGIN = process.env.AUTO_FINALIZE_ORIGIN || `http://localhost:${process.env.PORT || 3000}`;
const ACCESS_TOKEN_SECRET = process.env.SUPER_ADMIN_ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.SUPER_ADMIN_REFRESH_TOKEN_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "1d";
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

const normalizeText = (value) => String(value ?? "").trim();

const splitCommaValues = (value) =>
    String(value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

const toSerializable = (value) => JSON.parse(JSON.stringify(value ?? null));

const waitForNextPaint = () => new Promise((resolve) => setTimeout(resolve, 0));

const uniqueByKey = (items, keyFn) => {
    const seen = new Set();
    const output = [];

    for (const item of items || []) {
        const key = keyFn(item);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        output.push(item);
    }

    return output;
};

const createRandomBookingId = () => `OH${Date.now()}${Math.floor(Math.random() * 1000)}`;
const ALLOWED_AGE_UNITS = new Set(["Years", "Months", "Days"]);
const ALLOWED_GENDERS = new Set(["Male", "Female", "Any"]);

const matchAllowedValue = (value, allowedValues) => {
    const normalized = normalizeText(value).toLowerCase();
    // Keep this loose because some callers pass Arrays and some pass Sets.
    const allowedList = Array.isArray(allowedValues)
        ? allowedValues
        : Array.from(allowedValues || []);

    return allowedList.find((entry) => String(entry).toLowerCase() === normalized) || "";
};

const buildAuthTokens = (user) => {
    if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
        throw new ApiError(500, "JWT secrets are not configured for bulk auto finalize.");
    }

    const userId = user?._id ? user._id.toString() : null;
    const tenantId = user?.tenantId?._id ? user.tenantId._id.toString() : user?.tenantId ? user.tenantId.toString() : null;

    if (!userId) {
        throw new ApiError(500, "Invalid authenticated user context.");
    }

    const accessToken = jwt.sign(
        {
            _id: userId,
            tenantId,
            role: user?.role,
        },
        ACCESS_TOKEN_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
        {
            _id: userId,
        },
        REFRESH_TOKEN_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
};

const normalizeIds = (ids = []) =>
    uniqueByKey(
        (Array.isArray(ids) ? ids : [])
            .map((item) => ({
                id: item?.id ? item.id.toString() : "",
                collectionName: normalizeText(item?.collectionName),
            }))
            .filter((item) => item.id),
        (item) => `${item.id}__${item.collectionName}`
    );

const resolveBarcodeTestDetails = async (entry, session) => {
    const resolvedNames = [];
    const resolvedObjects = [];

    for (const obj of normalizeIds(entry?.ids || [])) {
        if (obj.collectionName === "testSchema") {
            const doc = await testSchema.findById(obj.id).select("Name").session(session);
            if (doc?.Name) {
                resolvedNames.push(doc.Name);
                resolvedObjects.push(obj);
            }
            continue;
        }

        if (obj.collectionName === "addPannel") {
            const doc = await addPannel.findById(obj.id).select("name").session(session);
            if (doc?.name) {
                resolvedNames.push(doc.name);
                resolvedObjects.push(obj);
            }
            continue;
        }

        if (obj.collectionName === "Package") {
            const doc = await Package.findById(obj.id)
                .select("testIds pannelIds")
                .populate("testIds pannelIds")
                .session(session);

            if (!doc) {
                continue;
            }

            const packageTestIds = new Set();
            const packagePanelIds = new Set();

            for (const test of doc.testIds || []) {
                if (test?.sampleType === entry?.typeOfSample && !packageTestIds.has(test._id.toString())) {
                    packageTestIds.add(test._id.toString());
                    if (test?.Name) {
                        resolvedNames.push(test.Name);
                    }
                    resolvedObjects.push({ id: test._id, collectionName: "testSchema" });
                }
            }

            for (const panel of doc.pannelIds || []) {
                if (panel?.sample_types?.[0] === entry?.typeOfSample && !packagePanelIds.has(panel._id.toString())) {
                    packagePanelIds.add(panel._id.toString());
                    if (panel?.name) {
                        resolvedNames.push(panel.name);
                    }
                    resolvedObjects.push({ id: panel._id, collectionName: "addPannel" });
                }
            }
        }
    }

    const fallbackNames = splitCommaValues(entry?.testName);
    const uniqueNames = [...new Set(resolvedNames.filter(Boolean))];
    const uniqueObjects = normalizeIds(resolvedObjects);

    return {
        testandpannelArray: uniqueNames.length > 0 ? uniqueNames : fallbackNames,
        testIds: uniqueObjects.length > 0 ? uniqueObjects : normalizeIds(entry?.ids || []),
    };
};

const normalizeTableData = (bookingInput = {}) => {
    const rawTableData = Array.isArray(bookingInput.TableData)
        ? bookingInput.TableData
        : Array.isArray(bookingInput.tableData)
            ? bookingInput.tableData
            : [];

    if (rawTableData.length > 0) {
        return rawTableData.map((entry, index) => ({
            order: Number(entry?.order || index + 1),
            typeOfSample: normalizeText(entry?.typeOfSample || entry?.typeOfSampleName || entry?.sampleType),
            barcodeId: normalizeText(entry?.barcodeId),
            confirmBarcodeId: normalizeText(entry?.confirmBarcodeId),
            testName: normalizeText(entry?.testName),
            ids: normalizeIds(entry?.ids || []),
        }));
    }

    const resolvedTests = Array.isArray(bookingInput.ResolvedTests)
        ? bookingInput.ResolvedTests
        : Array.isArray(bookingInput.resolvedTests)
            ? bookingInput.resolvedTests
            : [];

    if (resolvedTests.length === 0) {
        return [];
    }

    const testNames = splitCommaValues(bookingInput.TestNames || bookingInput.testNames || bookingInput.testName);
    const sampleMap = new Map();

    resolvedTests.forEach((testEntry, index) => {
        const sampleTypes = Array.isArray(testEntry?.sampleTypes) && testEntry.sampleTypes.length > 0
            ? testEntry.sampleTypes
            : (testEntry?.sampleType ? [testEntry.sampleType] : []);
        const fallbackTestName = testNames[index] || testEntry?.name || testEntry?.testName || "";
        const resolvedIds = normalizeIds([
            {
                id: testEntry?.id,
                collectionName: testEntry?.collectionName || testEntry?.collection || "testSchema",
            }
        ]);

        const targetSamples = sampleTypes.length > 0 ? sampleTypes : ["Unknown Sample"];

        targetSamples.forEach((sampleType) => {
            const key = normalizeText(sampleType).toLowerCase();
            if (!sampleMap.has(key)) {
                sampleMap.set(key, {
                    order: sampleMap.size + 1,
                    typeOfSample: sampleType,
                    barcodeId: createRandomBookingId(),
                    confirmBarcodeId: createRandomBookingId(),
                    testName: testNames.join(", "),
                    ids: [],
                });
            }

            const entry = sampleMap.get(key);
            entry.ids.push(...resolvedIds);
            if (!entry.testName && fallbackTestName) {
                entry.testName = fallbackTestName;
            }
        });
    });

    return Array.from(sampleMap.values()).map((entry, index) => ({
        ...entry,
        order: index + 1,
        ids: uniqueByKey(entry.ids, (item) => `${item.id}__${item.collectionName}`),
    }));
};

const normalizeBookingInput = (bookingInput = {}) => {
    const tableData = normalizeTableData(bookingInput);
    const bookingId = normalizeText(bookingInput.barcodeId || bookingInput.bookingId) || createRandomBookingId();
    const patientName = normalizeText(bookingInput.PatientName || bookingInput.patientName).toUpperCase();
    const patientPhone = normalizeText(bookingInput.PatientPhone || bookingInput.patientPhone) || "N/A";
    const yearText = normalizeText(bookingInput.year);
    let ageValueRaw = bookingInput.AgeValue ?? bookingInput.ageValue;
    let ageValue = Number(ageValueRaw);
    let ageUnit = matchAllowedValue(bookingInput.AgeUnit || bookingInput.ageUnit, ALLOWED_AGE_UNITS);
    const gender = matchAllowedValue(bookingInput.Gender || bookingInput.gender, ALLOWED_GENDERS);
    const testNames = splitCommaValues(bookingInput.TestNames || bookingInput.testNames || bookingInput.testName);
    const testResults = splitCommaValues(bookingInput.TestResults || bookingInput.testResults || bookingInput.results);

    // Bulk sheets sometimes carry age as a single "30 Years" string.
    // Keep that path open so we don't reject valid rows on formatting alone.
    if ((normalizeText(ageValueRaw) === "" || Number.isNaN(ageValue) || ageValue <= 0) && yearText) {
        const [rawValue, ...rawUnitParts] = yearText.split(/\s+/);
        const parsedAgeValue = Number(rawValue);
        const parsedAgeUnit = matchAllowedValue(rawUnitParts.join(" "), ALLOWED_AGE_UNITS);

        if (!Number.isNaN(parsedAgeValue) && parsedAgeValue > 0) {
            ageValueRaw = parsedAgeValue;
            ageValue = parsedAgeValue;
        }

        if (!ageUnit && parsedAgeUnit) {
            ageUnit = parsedAgeUnit;
        }
    }

    if (!patientName) {
        throw new ApiError(400, "Patient Name is required for bulk auto finalize.");
    }

    if (normalizeText(ageValueRaw) === "" || Number.isNaN(ageValue) || ageValue <= 0) {
        throw new ApiError(400, "Age Value is required and must be a number.");
    }

    if (!ageUnit) {
        throw new ApiError(400, "Age Unit must be 'Years', 'Months', or 'Days'.");
    }

    if (!gender) {
        throw new ApiError(400, "Gender must be 'Male', 'Female', or 'Any'.");
    }

    if (testNames.length === 0) {
        throw new ApiError(400, "Test Names are required for bulk auto finalize.");
    }

    if (testResults.length === 0) {
        throw new ApiError(400, "Test Results are required for bulk auto finalize.");
    }

    if (testNames.length !== testResults.length) {
        throw new ApiError(400, "Test Names and Test Results count must match.");
    }

    if (tableData.length === 0) {
        throw new ApiError(400, "At least one test/sample row is required.");
    }

    return {
        bookingId,
        patientName,
        patientPhone,
        ageValue,
        ageUnit,
        gender,
        testNames,
        testResults,
        tableData,
    };
};

const buildBrowserBookingSnapshot = (bookingDoc, bookingInput, tableData, bookingId) => {
    const bookingObject = toSerializable(bookingDoc);
    const acceptedbarcode = tableData
        .map((entry) => normalizeText(entry.confirmBarcodeId || entry.barcodeId))
        .filter(Boolean);

    bookingObject.acceptedbarcode = acceptedbarcode;
    bookingObject.barcodeDetails = tableData.map((entry) => ({
        barcode: normalizeText(entry.confirmBarcodeId || entry.barcodeId),
        sampleType: normalizeText(entry.typeOfSample || entry.sampleType),
        isLisPresent: false,
    }));
    bookingObject.bulkAutomation = {
        bookingId,
        testNames: splitCommaValues(bookingInput.TestNames || bookingInput.testNames || bookingInput.testName),
        testResults: splitCommaValues(bookingInput.TestResults || bookingInput.testResults || bookingInput.results),
    };

    return bookingObject;
};

const saveAcceptedBarcodeDocument = async (tenantId, bookingId, tableData, session) => {
    const barcodeEntries = [];
    let bookingBarcodeDoc = await acceptedBarcode.findOne({
        tenantId,
        bookingId,
    }).session(session);

    for (const entry of tableData) {
        const barcode = normalizeText(entry.confirmBarcodeId || entry.barcodeId);
        if (!barcode) {
            throw new ApiError(400, "Barcode is required for bulk auto finalize.");
        }

        const existingBarcode = await acceptedBarcode.findOne({
            tenantId,
            "barcodes.barcode": barcode,
        }).session(session);

        if (existingBarcode && existingBarcode.bookingId?.toString?.() !== bookingId.toString()) {
            throw new ApiError(400, `${barcode} barcode already present`);
        }

        const resolvedDetails = await resolveBarcodeTestDetails(entry, session);
        const barcodeEntry = {
            barcode,
            testandpannelArray: resolvedDetails.testandpannelArray,
            sampleType: normalizeText(entry.typeOfSample),
            testIds: resolvedDetails.testIds,
        };

        barcodeEntries.push(barcodeEntry);

        if (bookingBarcodeDoc) {
            await acceptedBarcode.updateOne(
                { tenantId, bookingId },
                {
                    $addToSet: {
                        barcodes: barcodeEntry,
                    },
                },
                { session }
            );
        } else {
            bookingBarcodeDoc = await acceptedBarcode.create([{
                tenantId,
                bookingId,
                barcodes: [barcodeEntry],
            }], { session });
        }
    }

    return barcodeEntries;
};

const createBookingDocument = async (bookingInput, tenantId, createdBy, createdbyuser, session) => {
    const normalized = normalizeBookingInput(bookingInput);

    let bookingId = normalized.bookingId;
    const manualBookingId = normalizeText(bookingInput.barcodeId || bookingInput.bookingId);

    if (manualBookingId) {
        const alreadyExists = await newBooking.exists({ tenantId, bookingId }).session(session);
        if (alreadyExists) {
            throw new ApiError(400, "Booking already exists");
        }
    } else {
        let attempts = 0;
        while (attempts < 10) {
            const exists = await newBooking.exists({ tenantId, bookingId }).session(session);
            if (!exists) {
                break;
            }
            bookingId = createRandomBookingId();
            attempts += 1;
        }
    }

    const payload = {
        bookingId,
        date: bookingInput.date ? new Date(bookingInput.date) : new Date(),
        time: normalizeText(bookingInput.time) || new Date().toTimeString().split(" ")[0].substring(0, 5),
        courierName: normalizeText(bookingInput.CourierName || bookingInput.courierName),
        courierId: normalizeText(bookingInput.CourierId || bookingInput.courierId),
        patientName: normalized.patientName,
        year: normalizeText(bookingInput.year || `${normalized.ageValue || ""} ${normalized.ageUnit || ""}`.trim()),
        gender: normalized.gender || "Any",
        patientPhone: normalized.patientPhone,
        doctorName: normalizeText(bookingInput.DoctorName || bookingInput.doctorName),
        labName: normalizeText(bookingInput.LabName || bookingInput.labName),
        franchisee: normalizeText(bookingInput.franchisee),
        clinicalHistory: normalizeText(bookingInput.ClinicalHistory || bookingInput.clinicalHistory),
        total: Number(bookingInput.Total ?? bookingInput.total ?? 0),
        tableData: normalized.tableData,
        tenantId,
        createdBy,
        createdbyuser,
        status: "pending",
        isreportready: false,
        discountamount: Number(bookingInput.DiscountAmount ?? bookingInput.discountamount ?? 0),
        discountunit: Number(bookingInput.DiscountPercentage ?? bookingInput.discountunit ?? 0),
    };

    const [createdBooking] = await newBooking.create([payload], { session });

    return {
        booking: createdBooking,
        bookingId,
        normalized,
    };
};

const fillResultsInLabReport = async (page, testNames, testResults) => {
    await page.waitForSelector("#tables-container .value-input", { timeout: 180000 });
    await page.waitForFunction(() => Array.from(document.querySelectorAll("#tables-container .value-input")).length > 0, {
        timeout: 180000,
    });

    const fillOutcome = await page.evaluate(({ pairs }) => {
        const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
        const inputs = Array.from(document.querySelectorAll("#tables-container .value-input"))
            .filter((input) => {
                const row = input.closest("tr");
                if (!row || row.classList.contains("exclude")) {
                    return false;
                }

                const style = window.getComputedStyle(input);
                return style.display !== "none" && style.visibility !== "hidden";
            });

        const visibleRows = inputs.map((input) => ({
            input,
            label: normalize(
                input.closest("tr")?.querySelector(".test-name")?.textContent ||
                input.getAttribute("data-id") ||
                ""
            ),
        }));

        if (visibleRows.length === 0) {
            throw new Error("No visible result inputs were found on the lab report page.");
        }

        if (pairs.length < visibleRows.length) {
            const expectedNames = pairs.map((pair) => pair.testName).join(", ");
            const visibleNames = visibleRows.map((entry) => entry.label || entry.input.getAttribute("data-id") || "").join(", ");
            throw new Error(
                `Test Results count mismatch. Excel rows: ${pairs.length}, report inputs: ${visibleRows.length}. ` +
                `Excel names: ${expectedNames}. Report inputs: ${visibleNames}`
            );
        }

        visibleRows.forEach((entry, index) => {
            const nextValue = pairs[index]?.result ?? "";
            entry.input.value = nextValue;
            entry.input.dispatchEvent(new Event("input", { bubbles: true }));
            entry.input.dispatchEvent(new Event("change", { bubbles: true }));
        });

        if (pairs.length > visibleRows.length) {
            console.warn(
                `Bulk auto finalize received ${pairs.length} results but only ${visibleRows.length} inputs were rendered. ` +
                "Extra results were ignored because the report page did not render matching inputs."
            );
        }

        return {
            filledCount: visibleRows.length,
            candidateCount: visibleRows.length,
            unmatched: [],
            orderedLabels: visibleRows.map((entry) => entry.label || entry.input.getAttribute("data-id") || ""),
        };
    }, {
        pairs: testNames.map((testName, index) => ({
            testName,
            result: testResults[index],
        })),
    });

    await waitForNextPaint();
    return fillOutcome;
};

const runBrowserFinalize = async ({
    bookingSnapshot,
    user,
    accessToken,
    refreshToken,
    testNames,
    testResults,
}) => {
    const BROWSER_READY_TIMEOUT_MS = 120000;
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
        ],
    });

    try {
        const createContext = browser.createBrowserContext
            ? browser.createBrowserContext.bind(browser)
            : browser.createIncognitoBrowserContext.bind(browser);

        const context = await createContext();
        const page = await context.newPage();
        page.setDefaultTimeout(BROWSER_READY_TIMEOUT_MS);
        page.setDefaultNavigationTimeout(BROWSER_READY_TIMEOUT_MS);
        page.on("console", (message) => {
            const text = message.text();
            if (text) {
                console.log(`[bulk-finalize browser:${message.type()}] ${text}`);
            }
        });
        page.on("pageerror", (error) => {
            console.error("[bulk-finalize browser pageerror]", error.message);
        });
        page.on("requestfailed", (request) => {
            console.error("[bulk-finalize browser requestfailed]", request.url(), request.failure()?.errorText || "unknown");
        });

        const logStep = (message) => {
            console.log(`[bulk-finalize] ${message}`);
        };

        const browserUser = toSerializable(user);
        const browserBooking = toSerializable(bookingSnapshot);

        await page.setCookie({
            name: "accessToken",
            value: accessToken,
            url: AUTO_FINALIZE_ORIGIN,
        });

        await page.setCookie({
            name: "refreshToken",
            value: refreshToken,
            url: AUTO_FINALIZE_ORIGIN,
        });

        // Seed the app shell before any page script runs.
        await page.evaluateOnNewDocument((payload) => {
            localStorage.setItem("user", JSON.stringify(payload.user));
            localStorage.setItem("accessToken", payload.accessToken);
            localStorage.setItem("refreshToken", payload.refreshToken);
            localStorage.setItem("booking", JSON.stringify(payload.booking));
            localStorage.setItem("myKey", payload.booking?._id || "");
            if (payload.user?.pdfFormat) {
                localStorage.setItem("pdfformat", payload.user.pdfFormat);
            }
            window.user = payload.user;
            window.userId = payload.user?._id || "";
            window.username = payload.user?.username || "";
            window.userRole = payload.user?.role || "";
            window.role = payload.user?.role || "";
            window.Name = payload.user?.fullName || "";
            window.booking = payload.booking;
            window.myKey = payload.booking?._id || "";
        }, {
            user: browserUser,
            accessToken,
            refreshToken,
            booking: browserBooking,
        });

        // labreport.js reads value1 during startup, so keep the booking id in the URL.
        logStep(`Opening labreport for ${bookingSnapshot.bookingId}`);
        await page.goto(`${AUTO_FINALIZE_ORIGIN}/admin/admin.html?page=labreport&value1=${encodeURIComponent(bookingSnapshot.bookingId)}`, {
            waitUntil: "domcontentloaded",
            timeout: BROWSER_READY_TIMEOUT_MS,
        });

        await page.waitForFunction(() => Boolean(window.user) && Boolean(localStorage.getItem("booking")), {
            timeout: BROWSER_READY_TIMEOUT_MS,
        });

        await page.waitForFunction(() => window.__bulkFinalizeLabreportReady === true, {
            timeout: BROWSER_READY_TIMEOUT_MS,
        });
        logStep(`Labreport shell ready for ${bookingSnapshot.bookingId}`);

        await page.waitForSelector("#finalBtn", { timeout: BROWSER_READY_TIMEOUT_MS });
        await fillResultsInLabReport(page, testNames, testResults);
        await page.waitForFunction(() => {
            const inputs = Array.from(document.querySelectorAll("#tables-container .value-input"));
            return inputs.length > 0 && inputs.every((input) => String(input.value ?? "").trim().length > 0);
        }, { timeout: BROWSER_READY_TIMEOUT_MS });

        const saveReportResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === "POST" &&
                response.url().includes("/api/v1/user/saveReportData"),
            { timeout: BROWSER_READY_TIMEOUT_MS }
        );

        const finalNavigationPromise = page.waitForNavigation({
            waitUntil: "domcontentloaded",
            timeout: BROWSER_READY_TIMEOUT_MS,
        }).catch(() => null);

        logStep(`Submitting final labreport for ${bookingSnapshot.bookingId}`);
        await page.click("#finalBtn");

        const saveReportResponse = await saveReportResponsePromise;
        if (!saveReportResponse.ok()) {
            throw new Error(`saveReportData failed with status ${saveReportResponse.status()}`);
        }

        await finalNavigationPromise;

        await page.waitForFunction(() => window.__bulkFinalizeReportReady === true, {
            timeout: BROWSER_READY_TIMEOUT_MS,
        });
        logStep(`Report format ready for ${bookingSnapshot.bookingId}`);

        await page.waitForSelector("#signOff", { timeout: BROWSER_READY_TIMEOUT_MS });

        const signoffRequests = [
            page.waitForResponse(
                (response) =>
                    response.request().method() === "POST" &&
                    response.url().includes("/api/v1/user/editReportsignofffield"),
                { timeout: BROWSER_READY_TIMEOUT_MS }
            ),
            page.waitForResponse(
                (response) =>
                    response.request().method() === "POST" &&
                    response.url().includes("/api/v1/user/adding-pdf-data"),
                { timeout: BROWSER_READY_TIMEOUT_MS }
            ),
            page.waitForResponse(
                (response) =>
                    response.request().method() === "POST" &&
                    response.url().includes("/api/v1/user/CompleteBookingcontroller"),
                { timeout: BROWSER_READY_TIMEOUT_MS }
            ),
        ];

        logStep(`Signing off report for ${bookingSnapshot.bookingId}`);
        await page.click("#signOff");
        const [signoffResponse, pdfDataResponse, completeResponse] = await Promise.all(signoffRequests);

        if (!signoffResponse.ok()) {
            throw new Error(`editReportsignofffield failed with status ${signoffResponse.status()}`);
        }

        if (!pdfDataResponse.ok()) {
            throw new Error(`adding-pdf-data failed with status ${pdfDataResponse.status()}`);
        }

        if (!completeResponse.ok()) {
            throw new Error(`CompleteBookingcontroller failed with status ${completeResponse.status()}`);
        }
        logStep(`Report sign off completed for ${bookingSnapshot.bookingId}`);

        const reportDoc = await reports
            .findOne({
                tenantId: browserUser?.tenantId?._id || browserUser?.tenantId || user?.tenantId?._id || user?.tenantId,
                bookingId: bookingSnapshot.bookingId,
            })
            .lean();

        const bookingDoc = await newBooking
            .findOne({
                tenantId: browserUser?.tenantId?._id || browserUser?.tenantId || user?.tenantId?._id || user?.tenantId,
                bookingId: bookingSnapshot.bookingId,
            })
            .select("status isreportready")
            .lean();

        return {
            reportId: reportDoc?._id || null,
            bookingStatus: bookingDoc?.status || null,
            isreportready: Boolean(bookingDoc?.isreportready),
        };
    } finally {
        await browser.close().catch(() => {});
    }
};

const processBulkAutoFinalizeRow = async (bookingInput, req) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const tenantId = req.user.tenantId._id || req.user.tenantId;
        const createdBy = req.user.role === "staff" && req.user.parentUser
            ? req.user.parentUser
            : req.user._id;
        const createdbyuser = req.user.username;

        const { booking, bookingId, normalized } = await createBookingDocument(
            bookingInput,
            tenantId,
            createdBy,
            createdbyuser,
            session
        );

        const tableData = normalizeTableData(bookingInput);
        const barcodeEntries = await saveAcceptedBarcodeDocument(tenantId, bookingId, tableData, session);

        // Create the report shell first. The browser step fills the rows, then sign-off closes the loop.
        await reports.findOneAndUpdate(
            {
                tenantId,
                bookingId,
            },
            {
                tenantId,
                createdBy,
                bookingId,
                date: booking.date || new Date(),
                time: booking.time || new Date().toTimeString().split(" ")[0].substring(0, 5),
                courierName: booking.courierName || "",
                courierId: booking.courierId || "",
                patientName: booking.patientName,
                year: booking.year || "",
                gender: booking.gender || "Any",
                patientPhone: booking.patientPhone || "N/A",
                doctorName: booking.doctorName || "",
                labName: booking.labName || "",
                franchisee: booking.franchisee || "",
                clinicalHistory: booking.clinicalHistory || "",
                total: Number(booking.total || 0),
                status: booking.status || "pending",
                signOff: false,
                CategoryAndTest: [],
                sampleDetails: [],
                uniquetestArray: [],
                isdocumented: false,
            },
            { upsert: true, new: true, session }
        );

        await session.commitTransaction();
        session.endSession();

        const { accessToken, refreshToken } = buildAuthTokens(req.user);
        const bookingSnapshot = buildBrowserBookingSnapshot(
            booking,
            bookingInput,
            tableData.length > 0 ? tableData : barcodeEntries.map((entry) => ({
                ...entry,
                confirmBarcodeId: entry.barcode,
            })),
            bookingId
        );

        const finalizeResult = await runBrowserFinalize({
            bookingSnapshot,
            user: req.user,
            accessToken,
            refreshToken,
            testNames: normalized.testNames,
            testResults: normalized.testResults,
        });

        return {
            bookingId,
            reportId: finalizeResult.reportId,
            status: finalizeResult.bookingStatus || "completed",
            isreportready: finalizeResult.isreportready,
            patientName: booking.patientName,
        };
    } catch (error) {
        try {
            await session.abortTransaction();
        } catch (_) {
            // Ignore session abort errors so we can return the original failure.
        }
        session.endSession();
        throw error;
    }
};

const bulkAutoFinalizeController = asyncHandler(async (req, res) => {
    const bookingsData = Array.isArray(req.body)
        ? req.body
        : Array.isArray(req.body?.bookings)
            ? req.body.bookings
            : [];

    if (bookingsData.length === 0) {
        throw new ApiError(400, "No booking data found to process.");
    }

    const successfulBookings = [];
    const failedBookings = [];

    for (const bookingInput of bookingsData) {
        try {
            const result = await processBulkAutoFinalizeRow(bookingInput, req);
            successfulBookings.push(result);
        } catch (error) {
            failedBookings.push({
                patient: normalizeText(bookingInput.PatientName || bookingInput.patientName || "Unknown"),
                bookingId: normalizeText(bookingInput.barcodeId || bookingInput.bookingId || ""),
                error: error.message,
            });
        }
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                successfulBookings,
                failedBookings,
            },
            "Bulk auto finalize completed."
        )
    );
});

export {
    bulkAutoFinalizeController,
};
