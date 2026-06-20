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
import { customization } from "../models/printsetting.model.js";
import { defaultpdfsetting } from "../models/defaultpdfsettings.model.js";
import { doctorsign } from "../models/labinchargesign.model.js";
import { Tenant } from "../models/tenant.model.js";
import { createCanvas } from "canvas";
import JsBarcode from "jsbarcode";
import qr from "qrcode";

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

const splitResults = (value) =>
    String(value ?? "")
        .split(",")
        .map((entry) => entry.trim());

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

const convertAgeToDays = (ageStr) => {
    if (!ageStr) return 0;
    const [val, unit] = ageStr.split(" ");
    const age = parseInt(val) || 0;
    if (unit?.toLowerCase() === "years") return age * 365;
    if (unit?.toLowerCase() === "months") return age * 30;
    if (unit?.toLowerCase() === "days") return age;
    return age * 365;
};

const getReferenceRangeValues = (patientDays, gender, normalValues = []) => {
    if (!normalValues.length) return { lower: null, upper: null, text: "" };
    const match = normalValues.find(range => {
        const minDays = convertAgeToDays(`${range.minAge} ${range.minAgeUnit}`);
        const maxDays = convertAgeToDays(`${range.maxAge} ${range.maxAgeUnit}`);
        const genderMatch = range.gender === "Any" || range.gender === gender;
        return genderMatch && patientDays >= minDays && patientDays <= maxDays;
    });
    return match ? { lower: parseFloat(match.lowerValue), upper: parseFloat(match.upperValue), text: `${match.lowerValue} - ${match.upperValue}` } : { lower: null, upper: null, text: "" };
};

const checkAbnormality = (value, lower, upper) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
        const val = String(value).toLowerCase();
        if (val.includes("positive") || val.includes("reactive") || (val.includes("detected") && !val.includes("not"))) return "H";
        return "";
    }
    if (lower !== null && num < lower) return "L";
    if (upper !== null && num > upper) return "H";
    return "";
};

const stripHtml = (html) => String(html || "").replace(/<[^>]*>?/gm, '');

const formatDateTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).replace(",", "");
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
        // If resolvedTests is missing, check if individual test names were provided in TestNames
        const testNames = splitCommaValues(bookingInput.TestNames || bookingInput.testNames || bookingInput.testName);
        if (testNames.length > 0) {
            // Create dummy table data entries based on unique sample types (defaulting to Blood if unknown)
            return [{
                order: 1,
                typeOfSample: "Blood",
                barcodeId: createRandomBookingId(),
                confirmBarcodeId: createRandomBookingId(),
                testName: testNames.join(", "),
                ids: testNames.map(name => ({
                    id: new mongoose.Types.ObjectId(), // This is a placeholder, will be resolved during hydration
                    collectionName: "testSchema",
                    nameHint: name
                }))
            }];
        }

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
    const testResults = splitResults(bookingInput.TestResults || bookingInput.testResults || bookingInput.results);

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

const calculateDerivedResults = (valuesMap) => {
    const getV = (key) => parseFloat(valuesMap.get(key)) || 0;

    // Formula logic from labreport.js
    if (valuesMap.has("NeutrophilsPercentage") && valuesMap.has("TotalLeucocytesCount")) {
        valuesMap.set("Neutrophils-AbsoluteCount", ((getV("NeutrophilsPercentage") / 100) * getV("TotalLeucocytesCount")).toFixed(2));
    }
    if (valuesMap.has("LymphocytePercentage") && valuesMap.has("TotalLeucocytesCount")) {
        valuesMap.set("Lymphocytes-AbsoluteCount", ((getV("LymphocytePercentage") / 100) * getV("TotalLeucocytesCount")).toFixed(2));
    }
    if (valuesMap.has("EosinophilsPercentage") && valuesMap.has("TotalLeucocytesCount")) {
        valuesMap.set("Eosinophil-AbsoluteCount", ((getV("EosinophilsPercentage") / 100) * getV("TotalLeucocytesCount")).toFixed(2));
    }
    if (valuesMap.has("MonocytesPercentage") && valuesMap.has("TotalLeucocytesCount")) {
        valuesMap.set("Monocyte-AbsoluteCount", ((getV("MonocytesPercentage") / 100) * getV("TotalLeucocytesCount")).toFixed(2));
    }
    if (valuesMap.has("BasophilsPercentage") && valuesMap.has("TotalLeucocytesCount")) {
        valuesMap.set("Basophils-AbsoluteCount", ((getV("BasophilsPercentage") / 100) * getV("TotalLeucocytesCount")).toFixed(2));
    }
    if (valuesMap.has("Hematocrit(HCT)") && valuesMap.has("TotalRedBloodCellCount")) {
        valuesMap.set("MeanCorpuscularVolume(MCV)", ((getV("Hematocrit(HCT)") * 10) / getV("TotalRedBloodCellCount")).toFixed(2));
    }
    if (valuesMap.has("Hemoglobin") && valuesMap.has("TotalRedBloodCellCount")) {
        valuesMap.set("MeanCorpuscularHemoglobin(MCH)", ((getV("Hemoglobin") * 10) / getV("TotalRedBloodCellCount")).toFixed(2));
    }
    if (valuesMap.has("Hemoglobin") && valuesMap.has("Hematocrit(HCT)")) {
        valuesMap.set("MeanCorpuscularHemoglobinConcentration(MCHC)", ((getV("Hemoglobin") * 100) / getV("Hematocrit(HCT)")).toFixed(2));
    }
    if (valuesMap.has("Triglycerides")) {
        valuesMap.set("VLDLCholesterol", (getV("Triglycerides") / 5).toFixed(2));
    }
    if (valuesMap.has("TotalCholesterol") && valuesMap.has("HDLCholesterol") && valuesMap.has("VLDLCholesterol")) {
        valuesMap.set("LDLCholesterol", (getV("TotalCholesterol") - getV("HDLCholesterol") - getV("VLDLCholesterol")).toFixed(2));
    }
    if (valuesMap.has("SerumUrea")) {
        valuesMap.set("BUN", (getV("SerumUrea") * 0.467).toFixed(2));
    }
};

const finalizeReportOnBackend = async (booking, normalized, tenantId, createdBy) => {
    // 1. Get hydrated data (Tests & Panels)
    const barcodeDoc = await acceptedBarcode.findOne({ 
        tenantId, 
        bookingId: booking.bookingId 
    }).lean();
    
    if (!barcodeDoc) throw new ApiError(404, "Barcodes not found for booking");

    const bDate = new Date(booking.date);
    const [hrs, mins] = String(booking.time || "00:00").split(':');
    const collectedOn = new Date(bDate.getFullYear(), bDate.getMonth(), bDate.getDate(), parseInt(hrs) || 0, parseInt(mins) || 0);
    const receivedOn = new Date(collectedOn.getTime() + 5 * 60 * 1000);
    const reportedOn = new Date(receivedOn.getTime() + 30 * 60 * 1000);

    const testIds = barcodeDoc.barcodes.flatMap(b => b.testIds || []);
    const singleTestIds = testIds.filter(t => t.collectionName === "testSchema").map(t => t.id);
    const panelIds = testIds.filter(t => t.collectionName === "addPannel").map(t => t.id);

    // Sort tests and panels by order to maintain sequence
    const [allSingleTests, allPanels] = await Promise.all([
        testSchema.find({ _id: { $in: singleTestIds } }).sort({ order: 1 }).lean(),
        addPannel.find({ _id: { $in: panelIds } })
            .populate({ path: "testsId", options: { sort: { order: 1 } } })
            .sort({ order: 1 })
            .lean()
    ]);

    const patientDays = convertAgeToDays(booking.year);
    const valuesMap = new Map();
    normalized.testNames.forEach((name, i) => {
        const cleanName = String(name || "").replace(/\s+/g, "").toLowerCase();
        valuesMap.set(cleanName, normalized.testResults[i]);
    });

    // 2. Apply formulas
    calculateDerivedResults(valuesMap);

    // 3. Build reportData (CategoryAndTest) - Grouped by Category
    const reportData = [];
    const categoryMap = new Map();

    const addTestToReport = (test, isFromPanel = false) => {
        const catName = normalizeText(test.category?.category || test.category || "Unknown");
        if (!categoryMap.has(catName)) {
            categoryMap.set(catName, { category: catName, title: catName, tests: [] });
            reportData.push(categoryMap.get(catName));
        }
        const categoryGroup = categoryMap.get(catName);

        if (test.parameters?.length > 1) {
            categoryGroup.tests.push({
                testName: test.Name,
                isMultiHeader: true,
                pagebreak: false
            });
            test.parameters.forEach(param => {
                const cleanParamName = String(param.Para_name || "").replace(/\s+/g, "").toLowerCase();
                const val = valuesMap.get(cleanParamName) ?? param.defaultresult ?? "";
                const ref = getReferenceRangeValues(patientDays, booking.gender, param.NormalValue);
                categoryGroup.tests.push({
                    testName: param.Para_name,
                    value: val,
                    unit: param.unit,
                    reference: ref.text,
                    isParameter: true,
                    pagebreak: false,
                    isAbnormal: checkAbnormality(val, ref.lower, ref.upper)
                });
            });
        } else {
            const param = test.parameters?.[0] || {};
            const cleanTestName = String(test.Name || "").replace(/\s+/g, "").toLowerCase();
            const val = valuesMap.get(cleanTestName) ?? param.defaultresult ?? "";
            const ref = getReferenceRangeValues(patientDays, booking.gender, param.NormalValue);
            categoryGroup.tests.push({
                testName: test.Name,
                value: val,
                unit: param.unit,
                reference: ref.text,
                pagebreak: false,
                isAbnormal: checkAbnormality(val, ref.lower, ref.upper)
            });
        }
    };

    allPanels.forEach(panel => {
        panel.testsId.forEach(test => addTestToReport(test, true));
    });
    allSingleTests.forEach(test => addTestToReport(test, false));

    // 4. Save to reports - FIX: Avoid spreading _id from booking
    const bookingSnapshot = booking.toObject ? booking.toObject() : { ...booking };
    const reportPayload = { ...bookingSnapshot };
    
    // CRITICAL FIX: Remove IDs that would conflict with reports collection
    delete reportPayload._id;
    delete reportPayload.__v;
    delete reportPayload.createdAt;
    delete reportPayload.updatedAt;

    const savedReport = await reports.findOneAndUpdate(
        { bookingId: booking.bookingId, tenantId },
        {
            ...reportPayload,
            CategoryAndTest: reportData,
            reg_id: booking.bookingId,
            status: "completed",
            signOff: true,
            collectedOn,
            receivedOn,
            reportedOn,
            categorizedPDF: true, // Start categories on new page
            uniquetestArray: normalized.testNames,
            MoreDetails: booking.clinicalHistory || ""
        },
        { upsert: true, new: true }
    );

    // 5. Populate customization (PDF Metadata)
    const pSettings = await defaultpdfsetting.findOne({ tenantId }).lean() || {};
    const sigs = await doctorsign.findOne({ tenantId }).lean() || {};
    const tenantDetails = await Tenant.findById(tenantId).select("modelType").lean();
    const is1Layer = tenantDetails?.modelType === "1layer";
    const forhideStyle = is1Layer ? 'style="display: none;"' : '';

    const formatReportDateTime = (dateVal) => {
        if (!dateVal) return "";
        const date = new Date(dateVal);
        if (isNaN(date.getTime())) return String(dateVal);

        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');

        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const amPm = hours >= 12 ? 'PM' : 'AM';

        hours = (hours % 12 || 12).toString().padStart(2, '0');

        return `${day}-${month}-${year} <span>${hours}:${minutes} ${amPm}</span>`;
    };

    const datePart = booking.date instanceof Date ? booking.date.toISOString().split('T')[0] : new Date(booking.date).toISOString().split('T')[0];
    const regOn = formatReportDateTime(datePart + "T" + (booking.time || "00:00"));
    const collOn = formatReportDateTime(collectedOn);
    const recOn = formatReportDateTime(receivedOn);
    const repOn = formatReportDateTime(reportedOn);

    let barcodeImageSrc = "";
    try {
        const barcodeDoc = await acceptedBarcode.findOne({ tenantId, bookingId: booking.bookingId }).lean();
        const barcodesList = barcodeDoc?.barcodes?.map(b => b.barcode) || [];
        const barcodeNumber = barcodesList[0] || booking.bookingId;
        
        if (barcodeNumber) {
            const canvas = createCanvas(800, 180);
            JsBarcode(canvas, barcodeNumber, {
                format: "CODE128",
                width: 2,
                height: 110,
                fontSize: 20,
                font: "sans-serif",
                textColor: "#000000",
                displayValue: true,
                background: "#ffffff",
                margin: 10,
                textMargin: 5,
            });
            barcodeImageSrc = canvas.toDataURL("image/png");
        }
    } catch (err) {
        console.error("Error generating barcode in bulk booking:", err.message);
    }

    let qrCodeDataUrl = "";
    try {
        const qrLink = `${AUTO_FINALIZE_ORIGIN}/pages/pages/download_reports.html?value=${encodeURIComponent(savedReport._id)}&id=${encodeURIComponent(tenantId)}`;
        qrCodeDataUrl = await qr.toDataURL(qrLink, { margin: 2 });
    } catch (err) {
        console.error("Error generating QR code in bulk booking:", err.message);
    }

    const headerHtml = `
    <div class="report-details">
        <div class="report-details-innerDiv2">
            <div class="left2">
                <div class="infor-div"><div class="tags">Patient Name:</div><div class="value">${booking.patientName?.toUpperCase()}</div></div>
                <div class="infor-div"><div class="tags">Age / Sex:</div> <div class="value">${booking.year} / ${booking.gender}</div></div>
                <div class="infor-div"><div class="tags">Referred By:</div> <div class="value">${booking.doctorName || "Self"}</div></div>
                <div class="infor-div"><div class="tags">Reg. no:</div> <div class="value">${booking.bookingId}</div></div>
                <div class="infor-div forhide" ${forhideStyle}><div class="tags">Lab Name:</div> <div class="value">${booking.labName || ""}</div></div>
                <div class="infor-div forhide" id="investDiv" ${is1Layer ? 'style="display: none;"' : ''}>
                    <div class="tags">Investigations:</div> 
                    <div class="value">${normalized.testNames.join(", ")}</div>
                </div>
            </div>
            <div class="right2">
                <div>
                    <div class="registered-div2">
                        <div class="registeration-tag2">Registered on:</div>
                        <div class="time-div">${regOn}</div>
                    </div>
                    <div class="registered-div2 forhide" ${forhideStyle}>
                        <div class="registeration-tag2">Collected on:</div>
                        <div class="time-div">${collOn}</div>
                    </div>
                    <div class="registered-div2 forhide" ${forhideStyle}>
                        <div class="registeration-tag2">Received on:</div>
                        <div class="time-div">${recOn}</div>
                    </div>
                    <div class="registered-div2">
                        <div class="registeration-tag2">Reported on:</div>
                        <div class="time-div">${repOn}</div>
                    </div>
                </div>
            </div>
            <div class="barcode-div2">
                <div class="barcode2">
                    <div id="barcodeContainer2">
                        <img id="barcodeImage" src="${barcodeImageSrc}" alt="Generated Barcode" />
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    const footerHtml = `
        <div class="signed-off-div">
            <div class="signed-off-div2">
                <div class="left-sign signdivstyleclass" style="display: ${sigs.showlabinchargesign ? 'block' : 'none'};">
                    <img src="${sigs.labinchargesign || ""}" width="90" height="32" /><br>
                    <div class="textspan">${sigs.labinchargeinfo || ""}</div>
                </div>
                <div class="left-sign signdivstyleclass" style="display: ${sigs.showfirstdoctorsign ? 'block' : 'none'};">
                    <img src="${sigs.firstdoctorsign || ""}" width="90" height="32" /><br>
                    <div class="textspan">${sigs.firstdoctorsigninfo || ""}</div>
                </div>
                <div class="sign click qr-div format3qrdiv" style="display: block;">
                    <img id="qrimg" src="${qrCodeDataUrl}" width="100" height="100">
                </div>
                <div class="right-sign signdivstyleclass" style="display: ${sigs.showseconddoctorsign ? 'block' : 'none'};">
                    <img src="${sigs.seconddoctorsign || ""}" width="90" height="32" /><br>
                    <div class="textspan">${sigs.seconddoctorsigninfo || ""}</div>
                </div>
            </div>
        </div>`;

    let cssContent = `
        .container {
            width: 100%;
            height: auto;
            margin: auto;
            background-color: #ffffff;
            padding: 50px 25px;
            border-radius: 8px;
            box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
            margin-bottom: 1rem;
            overflow: auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e5eaf2;
            padding-bottom: 10px;
        }

        .header h1 {
            font-size: 26px;
            margin: 0;
            color: #1a73e8;
        }

        .badge {
            background-color: #e8f0fe;
            color: #1a73e8;
            padding: 8px 12px;
            border-radius: 15px;
            font-size: 13px;
            font-weight: 600;
        }

        .report-details {
            width: 100%;
            margin-top: 1rem;
        }

        .report-details-innerDiv2 {
            position: relative;
            width: 95%;
            border: 1px solid black;
            padding: 0px 5px;
        }

        .left2 {
            display: inline-block;
        }

        .right2 {
            position: absolute;
            display: inline-block;
            left: 58%;
            transform: translateX(-50%);
        }

        .registeration-tag2 {
            width: 110px;
            display: inline-grid;
        }

        .registered-div2 {
            width: 144%;
            padding-top: 3px;
            padding-bottom: 3px;
        }

        .time-div {
            width: 43%;
            display: inline-flex;
            justify-content: space-between;
        }

        .barcode-div2 {
            display: inline-block;
            position: absolute;
            right: 2%;
            top: 25%;
        }

        #barcodeImage {
            height: 50px;
            width: 100px;
        }

        .footer {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 30px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5px;
        }

        th,
        td {
            text-align: left;
        }

        th {
            font-size: 14px;
            color: rgb(44, 44, 44)
        }

        td {
            font-size: 13px;
        }

        .unit i,
        .reference i {
            margin-left: 10px;
        }

        .signed-off-div {
            width: 92%;
            bottom: 1.5rem;
            margin-top: 2rem;
            margin-bottom: 4rem;
            overflow: auto;
        }

        .container2 {
            width: 95%;
            margin: 0px auto;
        }

        .infor-div {
            display: table;
            table-layout: fixed;
            border: none;
        }

        .tags {
            display: table-cell;
            min-width: 110px;
            vertical-align: top;
            box-sizing: border-box;
        }

        .value {
            display: table-cell;
            vertical-align: top;
            word-wrap: break-word;
        }

        .sign {
            display: none;
        }

        .details-row {
            padding-left: 20px;
            font-size: 10px;
        }

        h2 {
            text-align: center;
        }

        .headings {
            margin: 10px;
        }

        tbody {
            border-bottom: 1px solid rgb(44, 44, 44);
            font-size: 16px;
            padding-top: 1rem;
        }

        .page-break {
            page-break-before: always;
        }

        .wrong i,
        .delete-btn i {
            font-weight: 700;
            color: #7474746d;
        }

        .wrong i:hover,
        .delete-btn i:hover {
            font-weight: 700;
            color: #2b2b2b;
        }

        .delete-btn i {
            font-size: 1.5rem;
            padding-left: 0.5rem;
        }

        table {
            width: 100%;
        }

        th,
        td {
            text-align: left;
            word-wrap: break-word;
        }

        .deletion {
            width: 1rem;
        }

        .test-name {
            width: 40%;
            margin: 0px;
            padding: 0rem 0rem;
            position: relative;
        }

        td {
            padding-top: 2px;
        }

        .notes,
        .remark-row,
        .advice,
        .remarks {
            padding-left: 10px;
            font-style: italic;
            font-weight: bold;
        }

        .notes span,
        .remark-row span,
        .advice span,
        .remarks span {
            margin-left: 55%;
        }

        .notes div,
        .advice div,
        .remarks div,
        .remark-row div {
            display: inline-block;
            width: 60px;
        }

        .moreDetails {
            margin-top: 1rem;
        }

        .moreDetails span {
            font-weight: bold;
            font-style: italic;
        }

        .moreDetails div {
            padding-left: 16px;
        }

        .valuecell {
            padding-left: 52px !important;
        }

        .high-low div {
            width: 50px;
            display: inline-block;
        }

        .high-low span {
            display: inline-block;
        }

        th .valuecell {
            padding-left: 0px;
        }

        #investDiv {
            display: flex;
        }

        .signed-off-div2 {
            width: 92%;
            display: flex;
            justify-content: space-evenly;
        }

        .signed-off-div,
        .container {
            scrollbar-width: none;
            -ms-overflow-style: none;
        }

        .signed-off-div::-webkit-scrollbar,
        .container::-webkit-scrollbar {
            display: none;
        }

        .signdivstyleclass {
            width: 20%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
        }

        .qr-div {
            width: 9%;
        }

        .documented-content {
            overflow-x: auto;
            word-wrap: break-word;
            background: white;
        }

        .documented-content table {
            border-collapse: separate !important;
            border-spacing: 0;
            margin: 10px 0;
            width: 100% !important;
        }

        .documented-content table td,
        .documented-content table th {
            border: 1px solid #ddd !important;
            padding: 8px;
        }

        td[colspan="4"] {
            vertical-align: top;
        }

        .documented-content p {
            margin: 5px 0;
        }

        .documented-content ul,
        .documented-content ol {
            margin: 10px 0;
            padding-left: 20px;
        }

        .documented-content h1,
        .documented-content h2,
        .documented-content h3 {
            margin: 10px 0 5px 0;
        }

        thead tr {
            background-color: #f5f5f5 !important;
        }

        thead th {
            background-color: #f5f5f5 !important;
            font-weight: 600;
            padding: 8px 0px !important;
            border-bottom: 2px solid #ddd !important;
        }

        .documented-content {
            overflow-x: auto;
            word-wrap: break-word;
            background: white;
        }

        .documented-content table {
            border-collapse: separate !important;
            border-spacing: 0 !important;
            margin: 10px 0 !important;
            width: 100% !important;
            background: white !important;
        }

        .documented-content table td,
        .documented-content table th {
            border: 1px solid #ddd !important;
            padding: 8px !important;
            background: white !important;
        }

        .documented-content table thead th {
            background-color: #e9ecef !important;
            font-weight: 600;
        }

        .documented-content p {
            margin: 8px 0;
        }

        .documented-content ul,
        .documented-content ol {
            margin: 10px 0;
            padding-left: 25px;
        }

        .documented-content h1 {
            font-size: 1.8em;
            margin: 15px 0 10px 0;
            font-weight: bold;
        }

        .documented-content h2 {
            font-size: 1.5em;
            margin: 12px 0 8px 0;
            font-weight: bold;
        }

        .documented-content h3 {
            font-size: 1.3em;
            margin: 10px 0 6px 0;
            font-weight: bold;
        }

        .documented-content h4,
        .documented-content h5,
        .documented-content h6 {
            margin: 8px 0 4px 0;
            font-weight: bold;
        }

        .documented-content blockquote {
            border-left: 4px solid #ddd;
            padding-left: 15px;
            margin: 10px 0;
            color: #666;
            font-style: italic;
        }

        .documented-content pre {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            overflow-x: auto;
            margin: 10px 0;
        }

        .documented-content code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }

        .documented-content img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 10px 0;
        }

        .documented-content a {
            color: #1a73e8;
            text-decoration: underline;
        }

        td[colspan="4"] {
            vertical-align: top;
            padding: 0 !important;
        }

        .details-row {
            padding: 0 !important;
            font-size: 13px;
        }

        .details-row .documented-content {
            padding-left: 20px;
        }

        .interpretation {
            padding: 10px;
        }

        .interpretation p {
            margin: 5px 0;
        }

        .moreDetails .documented-content {
            padding-left: 20px;
        }

        @media print {
            thead tr {
                background-color: #f5f5f5 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            thead th {
                background-color: #f5f5f5 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .documented-content table td,
            .documented-content table th {
                border: 1px solid #000 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }

        @media screen and (max-width: 956px) {
            .high-low div {
                text-align: center;
            }

            .report-details-innerDiv2 {
                font-size: 12px;
            }

            td {
                font-size: 11px;
            }

            .container22 {
                min-width: 712px;
            }

            .signed-off-div {
                width: 95%;
            }

            .signed-off-div2 {
                min-width: 712px;
            }

            .downloadDiv button span {
                display: none;
            }

            #downloadPDF i,
            #signOff i,
            #PDFsetting i,
            #BrowserPrint i,
            #sendReport i {
                font-size: 1rem;
                margin: 0px;
            }

            #downloadPDF,
            #signOff,
            #PDFsetting,
            #BrowserPrint,
            #sendReport {
                padding: 0.5rem 0.75rem;
            }

            .popup-modal {
                width: 100%;
            }

            .popup-content {
                width: 40rem;
            }
        }

        @keyframes spin {
            0% {
                transform: rotate(0deg);
            }
            100% {
                transform: rotate(360deg);
            }
        }

        @media print {
            table,
            tr,
            td,
            p {
                margin: 0 !important;
                border-spacing: 0 !important;
                border-collapse: collapse !important;
                line-height: 1 !important;
            }

            .infor-div {
                padding-top: 0px !important;
                padding-bottom: 0px !important;
            }

            .registered-div2 {
                padding-top: 0px !important;
                padding-bottom: 0px !important;
            }

            .signed-off-div2 {
                justify-content: space-between;
            }
            .barcode-div2 {
                top: 18% !important;
            }
        }
    `;

    if (is1Layer) {
        cssContent += `
        @media print {
            .barcode-div2 {
                top: 6%;
            }
        }
        `;
    }

    let bodyHtml = '<div class="container2">';
    reportData.forEach((cat, index) => {
        const pageBreakClass = (index > 0) ? 'page-break' : '';
        bodyHtml += `<div class="section ${pageBreakClass}">`;
        
        bodyHtml += `<div class="headings">`;
        bodyHtml += `<h2>${cat.category}<span class="delete-btn wrong"><i class="fa-sharp fa-solid fa-xmark" title="Delete Entire category section"></i></span></h2>`;
        if (cat.category !== cat.title && cat.title && !cat.title.includes('Unknown Title')) {
            bodyHtml += `<h3>${cat.title}<span class="delete-btn"><i class="fa-sharp fa-solid fa-xmark" title="Delete Pannel"></i></span></h3>`;
        }
        bodyHtml += `</div>`;
        
        bodyHtml += `<table class="test-table">`;
        bodyHtml += `<thead><tr><th class="deletion"></th><th>Test Name</th><th class="valuecell">Value</th><th>Unit</th><th>Reference</th></tr></thead>`;
        bodyHtml += `<tbody>`;

        cat.tests.forEach((test) => {
            let isBold = false;
            let testNameSuffix = "";

            if (test.reference) {
                const referenceParts = test.reference.split(" - ");
                if (referenceParts.length === 2) {
                    const lowerLimit = parseFloat(referenceParts[0]);
                    const upperLimit = parseFloat(referenceParts[1]);
                    const testValue = parseFloat(test.value);

                    if (!isNaN(lowerLimit) && !isNaN(upperLimit) && !isNaN(testValue)) {
                        if (testValue < lowerLimit) {
                            isBold = true;
                            testNameSuffix = "L";
                        } else if (testValue > upperLimit) {
                            isBold = true;
                            testNameSuffix = "H";
                        }
                    }
                }
            }

            if (typeof test.value === "string" && test.value.toLowerCase().includes("positive")) {
                isBold = true;
            }

            const boldClass = isBold ? 'class="BoldRow" style="font-weight: bold;"' : '';
            const rowPageBreakClass = test.pagebreak ? 'page-break' : '';
            
            if (test.isMultiHeader) {
                bodyHtml += `<tr class="${rowPageBreakClass}"><td class="wrong"><span class="delete-row-icon" title="Delete Row"><i class="fa-sharp fa-solid fa-xmark"></i></span></td><td colspan="4" style="font-weight:700; text-decoration:underline; padding-top:10px;">${String(test.testName).toUpperCase()}</td></tr>`;
            } else if (test.isDocumented) {
                bodyHtml += `<tr ${boldClass} class="${rowPageBreakClass}"><td class="wrong"><span class="delete-row-icon" title="Delete Row"><i class="fa-sharp fa-solid fa-xmark"></i></span></td><td colspan="4" style="padding: 0; border: none;"><div class="documented-content">${test.testName || ""}</div></td></tr>`;
            } else {
                bodyHtml += `<tr ${boldClass} class="${rowPageBreakClass}">
                    <td class="wrong"><span class="delete-row-icon" title="Delete Row"><i class="fa-sharp fa-solid fa-xmark"></i></span></td>
                    <td class="test-name">${test.testName || ""}</td>
                    <td class="high-low">
                        <div class="HL"><span>${testNameSuffix}</span></div>
                        <span>${test.value || ""}</span>
                    </td>
                    <td>${test.unit || ""}</td>
                    <td>${test.reference || ""}</td>
                </tr>`;
            }

            if (test.remark) {
                bodyHtml += `<tr><td class="wrong"></td><td colspan="4" class="remark-row"><div>Remark:</div> <span>${test.remark}</span></td></tr>`;
            }
            if (test.details) {
                bodyHtml += `<tr><td class="wrong"></td><td colspan="4" class="details-row"><div class="documented-content">${test.details}</div></td></tr>`;
            }
        });

        if (cat.advice) {
            bodyHtml += `<tr><td class="wrong"></td><td colspan="4" class="advice"><div>Advice:</div> <span class="documented-content">${cat.advice}</span></td></tr>`;
        }
        if (cat.notes) {
            bodyHtml += `<tr><td class="wrong"></td><td colspan="4" class="notes"><div>Notes:</div> <span class="documented-content">${cat.notes}</span></td></tr>`;
        }
        if (cat.remarks) {
            bodyHtml += `<tr><td class="wrong"></td><td colspan="4" class="remarks"><div>Remarks:</div> <span class="documented-content">${cat.remarks}</span></td></tr>`;
        }

        bodyHtml += '</tbody>';

        if (cat.interpretation) {
            bodyHtml += `<tbody><tr><td class="wrong"></td><td colspan="4"><div class="interpretation"><p style="font-weight: bold;">Interpretation</p><div class="documented-content">${cat.interpretation}</div></div></td></tr></tbody>`;
        }

        bodyHtml += '</table>';
        bodyHtml += '</div>'; // End of section
    });

    if (savedReport.MoreDetails) {
        bodyHtml += `<div class="moreDetails"><span>Additional Findings :-</span><br><div class="documented-content">${savedReport.MoreDetails}</div></div>`;
    }

    bodyHtml += '</div>'; // End of container2

    await customization.findOneAndUpdate(
        { reportId: savedReport._id, tenantId },
        {
            tenantId,
            createdBy,
            reportId: savedReport._id,
            bookingId: booking.bookingId,
            header: headerHtml,
            footer: footerHtml,
            htmlContent: bodyHtml,
            cssContent: cssContent,
            headermargin: pSettings.headermargin || "2.8",
            footermargin: pSettings.footermargin || "1",
            investigationmargin: 140,
            selectedFontSize: pSettings.selectedFontSize || 12,
            RowSpacing: pSettings.RowSpacing || 7,
            updatedAt: new Date()
        },
        { upsert: true }
    );

    // 6. Update Booking status
    await newBooking.findOneAndUpdate(
        { bookingId: booking.bookingId, tenantId },
        { status: "completed", isreportready: true }
    );

    return { reportId: savedReport._id };
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
        
        const bDate = new Date(booking.date);
        const [hrs, mins] = String(booking.time || "00:00").split(':');
        const collectedOn = new Date(bDate.getFullYear(), bDate.getMonth(), bDate.getDate(), parseInt(hrs) || 0, parseInt(mins) || 0);
        const receivedOn = new Date(collectedOn.getTime() + 5 * 60 * 1000);

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
                collectedOn,
                receivedOn,
                categorizedPDF: true,
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

        // Replace Puppeteer with direct backend finalization
        const finalizeResult = await finalizeReportOnBackend(
            booking,
            normalized,
            tenantId,
            createdBy
        );
        
        const updatedBooking = await newBooking.findOne({ bookingId, tenantId }).select("status isreportready").lean();

        return {
            bookingId,
            reportId: finalizeResult.reportId,
            status: updatedBooking.status,
            isreportready: updatedBooking.isreportready,
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
