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

const PARTIALLY_COMPLETED_STATUS = "Partially Completed";

const normalizeSampleText = (value) => String(value ?? "").trim();

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

const SaveReportController = asyncHandler(async (req, res) => {
    const { reportData, reg_id, booking, collectedOn, receivedOn, reportedOn, categorized,
        moredetails, uniquetestArray, isdocumented, saveMode } = req.body;

    const tenantId = req.user.tenantId._id;


    if (!reportData || !reg_id || !booking) {
        throw new ApiError(500, "please try again after sometime, and fill all test values")
    }

    const existingBooking = await newBooking.findOne({
        bookingId: booking.bookingId,
        tenantId
    }).select("status isreportready");

    const currentBookingStatus = existingBooking?.status || booking.status || "pending";
    let bookingStatus = currentBookingStatus;
    const sampleDetails = buildUniqueSampleDetails(reportData);

    const canUpdatePartialStatus = saveMode === "saveOnly"
        && existingBooking
        && !existingBooking.isreportready
        && currentBookingStatus.toLowerCase() !== "completed";

    if (canUpdatePartialStatus) {
        if (hasExactDotOnlyValue(reportData)) {
            bookingStatus = PARTIALLY_COMPLETED_STATUS;
        } else if (currentBookingStatus === PARTIALLY_COMPLETED_STATUS) {
            bookingStatus = "pending";
        }
    }

    const savedREport = await reports.findOneAndUpdate(
        {
            bookingId: booking.bookingId,
            tenantId: tenantId,
        },
        {
            CategoryAndTest: reportData,
            reg_id,
            ...booking,
            status: bookingStatus,
            collectedOn,
            receivedOn,
            reportedOn,
            categorizedPDF: categorized,
            MoreDetails: moredetails,
            uniquetestArray,
            sampleDetails,
            isdocumented
        },
        {
            upsert: true,
            new: true
        }
    )

    if (!savedREport) {
        throw new ApiError(400, "please try again after sometime, report not saved");
    }

    if (existingBooking && bookingStatus !== currentBookingStatus) {
        await newBooking.findOneAndUpdate(
            {
                bookingId: booking.bookingId,
                tenantId
            },
            { status: bookingStatus },
            { new: true }
        );
    }

      // अगर staff का parentUser है तो उसे भी notify करें
        if (req.user.role === 'staff') {
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

    return res.status(200).json(responsePayload);
})

const editReportController = asyncHandler(async (req, res) => {
    const { reportData, reg_id, booking, signedBy, collectedOn, receivedOn, reportedOn } = req.body;

    if (!reportData || !reg_id || !booking || !signedBy) {
        throw new ApiError(500, "please try again after sometime, and fill all test values")
    }

    const savedREport = await reports.findOneAndUpdate(
        { bookingId: booking.bookingId },
        {
            CategoryAndTest: reportData,
            reg_id,
            ...booking,
            signedBy,
            collectedOn,
            receivedOn,
            reportedOn,
            sampleDetails: buildUniqueSampleDetails(reportData)
        },
        { new: true }
    )

    if (!savedREport) {
        throw new ApiError(400, "please try again after sometime, report not saved");
    }

    return res.status(200).json(savedREport);
})

const editReportsignofffieldController = asyncHandler(async (req, res) => {
    const { value1, signoff } = req.body;

    if (!value1) {
        console.log("value1 is not recieved for edit report sign off field");
        throw new ApiError(500, "value1 is not recieved for edit report sign off field");
    }

    let savedREport;
    if (mongoose.Types.ObjectId.isValid(value1)) {
        savedREport = await reports.findOneAndUpdate(
            { _id: value1 },
            {
                signOff: signoff
            },
            { new: true }
        )
    } else {
        savedREport = await reports.findOneAndUpdate(
            { bookingId: value1 },
            {
                signOff: signoff
            },
            { new: true }
        )
    }

    if (!savedREport) {
        console.log("signoff field not updated");
        throw new ApiError(400, "please try again after sometime, report not saved");
    }

    return res.status(200).json(savedREport);
})

const getReportController = asyncHandler(async (req, res) => {
    const { value1, bookingId } = req.body;
    const tenantId = req.user.tenantId._id;
    // console.log( typeof bookingId)
    // console.log(typeof value1)
    // Pehle bookingId ke basis par report dhundho
    let Report = await reports.findOne({
        bookingId: value1,
        tenantId: tenantId
    });

    // Agar bookingId se report na mile aur value1 ek valid ObjectId hai to _id se dhundho
    if (Report == null && mongoose.Types.ObjectId.isValid(value1)) {
        Report = await reports.findOne({
            _id: value1,
            tenantId: tenantId
        });
    }

    // Agar Report nahi mili to error throw karo
    if (!Report) {
        throw new ApiError(400, "Please try again after sometime, report not found");
    }

    const printSettings = (await customization.findOne({ reportId: Report._id }).lean()) ||
        (await defaultpdfsetting.findOne({ tenantId }).lean()) ||
        {};

    return res.status(200).json({
        ...Report.toObject(),
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
    });

    const user = await User.findOne({
        tenantId: tenantId,
    }).select("pdfFormat");

    const usertenant = await Tenant.findById(tenantId).select("modelType");

    // Agar bookingId se report na mile aur value1 ek valid ObjectId hai to _id se dhundho
    if (Report == null && mongoose.Types.ObjectId.isValid(value1)) {
        Report = await reports.findOne({
            _id: value1,
            tenantId: tenantId
        });
    }

    Report.pdfFormat = user.pdfFormat;
    Report.layerOne = usertenant.modelType;
    // Agar Report nahi mili to error throw karo
    if (!Report) {
        throw new ApiError(400, "Please try again after sometime, report not found");
    }

    const printSettings = (await customization.findOne({ reportId: Report._id }).lean()) ||
        (await defaultpdfsetting.findOne({ tenantId }).lean()) ||
        {};

    return res.status(200).json({
        ...Report.toObject(),
        printSettings,
    });
});

export {
    SaveReportController,
    getReportController,
    getReportByBookingId,
    editReportController,
    editReportsignofffieldController,
    getReportControlleruser
}
