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

    const datePart = booking.date instanceof Date ? booking.date.toISOString().split('T')[0] : new Date(booking.date).toISOString().split('T')[0];
    const regOn = formatDateTime(datePart + "T" + (booking.time || "00:00"));
    const collOn = formatDateTime(collectedOn);
    const recOn = formatDateTime(receivedOn);
    const repOn = formatDateTime(reportedOn);

    const headerHtml = `
    <div class="report-details">
        <div class="report-details-innerDiv2">
            <div class="left2">
                <div class="infor-div"><div class="tags"><strong>Patient Name :</strong></div><div class="value"><strong>${booking.patientName?.toUpperCase()}</strong></div></div>
                <div class="infor-div forhide"><div class="tags">Lab Name :</div> <div class="value">${booking.labName || ""}</div></div>
                <div class="infor-div"><div class="tags">Age / Sex :</div> <div class="value">${booking.year} / ${booking.gender}</div></div>
                <div class="infor-div"><div class="tags">Referred By :</div> <div class="value">${booking.doctorName || "Self"}</div></div>
                <div class="infor-div"><div class="tags">Reg. no :</div> <div class="value">${booking.bookingId}</div></div>
                <div class="infor-div forhide" id="investDiv">
                    <div class="tags">Investigations :</div> 
                    <div class="value">${normalized.testNames.join(", ")}</div>
                </div>
            </div>
            <div class="right2">
                <div>
                    <div class="registered-div2">
                        <div class="registeration-tag2">Registered on :</div>
                        <div class="time-div">${regOn}</div>
                    </div>
                    <div class="registered-div2 forhide">
                        <div class="registeration-tag2">Collected on :</div>
                        <div class="time-div">${collOn}</div>
                    </div>
                    <div class="registered-div2 forhide">
                        <div class="registeration-tag2">Received on :</div>
                        <div class="time-div">${recOn}</div>
                    </div>
                    <div class="registered-div2">
                        <div class="registeration-tag2">Reported on :</div>
                        <div class="time-div">${repOn}</div>
                    </div>
                    <div class="registered-div2">
                        <div class="registeration-tag2"><strong>Report Status :</strong></div>
                        <div class="time-div"><strong>${booking.status || "Completed"}</strong></div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    const footerHtml = `
        <div class="signed-off-div">
            <div class="signed-off-div2">
                ${sigs.showlabinchargesign ? `<div class="signdivstyleclass"><img src="${sigs.labinchargesign}" width="90" height="32" /><br><div class="textspan">${sigs.labinchargeinfo}</div></div>` : ''}
                ${sigs.showfirstdoctorsign ? `<div class="signdivstyleclass"><img src="${sigs.firstdoctorsign}" width="90" height="32" /><br><div class="textspan">${sigs.firstdoctorsigninfo}</div></div>` : ''}
                <div class="right-sign signdivstyleclass" style="display: ${sigs.showseconddoctorsign ? 'flex' : 'none'};">
                    <img src="${sigs.seconddoctorsign || ""}" width="90" height="32" /><br>
                    <div class="textspan">${sigs.seconddoctorsigninfo || ""}</div>
                </div>
                <div class="sign click qr-div format3qrdiv">
                    <img id="qrimg" src="https://res.cloudinary.com/dmlfjbpb5/image/upload/v1730987604/vximbk8olbhmhmhp5ele.jpg" width="80" height="80">
                </div>
            </div>
        </div>`;

    const cssContent = `
        .container2 { width: 100%; margin: 0 auto; }
        .report-details { width: 100%; margin-top: 1rem; }
        .report-details-innerDiv2 { position: relative; width: 95%; border: 1px solid black; padding: 5px; font-size: 13px; display: flex; justify-content: space-between; margin: 0 auto; }
        .left2 { width: 55%; }
        .right2 { width: 40%; border-left: 1px solid #ccc; padding-left: 10px; }
        .infor-div { display: table; table-layout: fixed; width: 100%; margin-bottom: 2px; }
        .tags { display: table-cell; width: 110px; font-weight: bold; vertical-align: top; }
        .value { display: table-cell; word-wrap: break-word; vertical-align: top; }
        .registered-div2 { display: flex; justify-content: space-between; margin-bottom: 3px; }
        .registeration-tag2 { width: 110px; font-weight: bold; }
        .time-div { flex: 1; text-align: right; }
        .test-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .test-table thead th { border-bottom: 2px solid #333; text-align: left; padding: 8px 5px; font-size: 14px; background-color: #f8f9fa; }
        .test-table td { padding: 5px; font-size: 13px; vertical-align: top; border-bottom: 1px solid #eee; }
        .section h2 { text-align: center; margin: 15px 0 5px; font-size: 18px; color: #1a73e8; }
        .section h3 { text-align: center; margin: 0 0 10px; font-size: 14px; font-style: italic; }
        .page-break { page-break-before: always; }
        .signed-off-div { width: 95%; margin: 2rem auto; }
        .signed-off-div2 { display: flex; justify-content: space-around; align-items: flex-end; }
        .signdivstyleclass { text-align: center; width: 25%; font-size: 12px; }
        .qr-div { width: 80px; height: 80px; }
        .high-low { display: flex; align-items: center; }
        .HL { width: 30px; font-weight: bold; color: #d32f2f; }
        .BoldRow { font-weight: bold; }
        .documented-content { line-height: 1.5; word-wrap: break-word; }
        .documented-content table { width: 100% !important; border-collapse: collapse !important; margin: 10px 0 !important; }
        .documented-content td { border: 1px solid #ddd !important; padding: 5px !important; }
        .interpretation { background: #f9f9f9; padding: 10px; margin-top: 10px; border-radius: 4px; }
        .remark-row, .advice, .notes, .remarks { font-style: italic; font-size: 12px; color: #444; padding: 5px 0; }
    `;

    let bodyHtml = '<div class="container2">';
    reportData.forEach((cat, index) => {
        const pageBreakClass = (index > 0) ? 'page-break' : '';
        bodyHtml += `<div class="section ${pageBreakClass}"><h2>${cat.category}</h2><h3>${(cat.title && cat.title !== cat.category) ? cat.title : ''}</h3><table class="test-table"><thead><tr><th style="width:40%">Test Name</th><th style="width:20%">Value</th><th style="width:15%">Unit</th><th style="width:25%">Reference</th></tr></thead><tbody>`;
        cat.tests.forEach(t => {
            if (t.isMultiHeader) {
                bodyHtml += `<tr><td colspan="4" style="font-weight:700; text-decoration:underline; padding-top:10px;">${String(t.testName).toUpperCase()}</td></tr>`;
                return;
            }
            
            if (t.isDocumented) {
                bodyHtml += `<tr><td colspan="4"><div class="documented-content">${t.testName}</div></td></tr>`;
            } else {
                const boldClass = t.isAbnormal ? 'class="BoldRow"' : '';
                const hlColor = t.isAbnormal && pSettings.HLinred ? 'style="color:#d32f2f;"' : '';
                bodyHtml += `<tr ${boldClass}><td>${t.testName}</td><td class="high-low" ${hlColor}><div class="HL">${t.isAbnormal || ''}</div><span>${t.value || ""}</span></td><td>${t.unit || ""}</td><td>${t.reference || ""}</td></tr>`;
            }

            if (t.remark) {
                bodyHtml += `<tr><td colspan="4" class="remark-row"><strong>Remark:</strong> ${t.remark}</td></tr>`;
            }
            if (t.details) {
                bodyHtml += `<tr><td colspan="4"><div class="documented-content">${t.details}</div></td></tr>`;
            }
        });
        
        if (cat.advice) bodyHtml += `<tr><td colspan="4" class="advice"><strong>Advice:</strong> <span class="documented-content">${cat.advice}</span></td></tr>`;
        if (cat.notes) bodyHtml += `<tr><td colspan="4" class="notes"><strong>Notes:</strong> <span class="documented-content">${cat.notes}</span></td></tr>`;
        if (cat.remarks) bodyHtml += `<tr><td colspan="4" class="remarks"><strong>Remarks:</strong> <span class="documented-content">${cat.remarks}</span></td></tr>`;
        
        bodyHtml += '</tbody></table>';
        
        if (cat.interpretation) {
            bodyHtml += `<div class="interpretation"><strong>Interpretation:</strong><div class="documented-content">${cat.interpretation}</div></div>`;
        }
        bodyHtml += '</div>';
    });
    
    if (savedReport.MoreDetails) {
        bodyHtml += `<div class="moreDetails" style="margin-top:20px; padding:10px; border-top:1px solid #ddd;"><strong>Additional Findings:</strong><div class="documented-content">${savedReport.MoreDetails}</div></div>`;
    }

    bodyHtml += '</div>';

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
