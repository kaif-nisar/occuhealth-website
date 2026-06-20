import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { categorydb, Counter } from "../models/category.model.js"
import { testSchema } from "../models/newTest.model.js"
import { testCounter } from "../models/counterTests.model.js"
import mongoose from "mongoose"
import { sampleSchema } from "../models/sampletype.model.js";
import { unitdb } from "../models/category.model.js";
import { addPannel } from "../models/AddPannel.model.js";
import { Package } from "../models/addPackage.model.js";
import { Tenant } from "../models/tenant.model.js";
import { User } from "../models/user.model.js";
import { SuperAdmin } from "../models/superAdmin.model.js";
import { create } from "browser-sync";

const normalizeShortNameList = (shortNames = [], defaultShortName = "") => {
    const uniqueShortNames = [...new Set(
        (Array.isArray(shortNames) ? shortNames : [])
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
    )];

    const normalizedDefault = typeof defaultShortName === "string" ? defaultShortName.trim() : "";

    if (normalizedDefault && !uniqueShortNames.includes(normalizedDefault)) {
        uniqueShortNames.unshift(normalizedDefault);
    }

    return {
        shortNames: uniqueShortNames,
        defaultShortName: normalizedDefault || uniqueShortNames[0] || "",
    };
};

const normalizeParameters = (parameters = [], testShortName = "") => {
    const safeParameters = Array.isArray(parameters) ? parameters : [];

    return safeParameters.map((parameter, index) => {
        const normalizedParameter = parameter && typeof parameter === "object" ? { ...parameter } : {};
        const isSingleParameterTest = safeParameters.length === 1;
        const fallbackDefault = isSingleParameterTest ? testShortName : "";
        const normalizedShortNames = normalizeShortNameList(
            normalizedParameter.shortNames,
            normalizedParameter.defaultShortName || fallbackDefault
        );

        return {
            ...normalizedParameter,
            order: Number(normalizedParameter.order) || index + 1,
            Para_name: typeof normalizedParameter.Para_name === "string" ? normalizedParameter.Para_name.trim() : "",
            shortNames: normalizedShortNames.shortNames,
            defaultShortName: normalizedShortNames.defaultShortName,
        };
    });
};



// superAdmin creating Test
const addingTest = asyncHandler(async (req, res) => {
    // trim all values in req.body
    Object.entries(req.body).forEach(([key, value]) => {
        if (typeof value === "string") {
            req.body[key] = value.trim()
        }
    })

    let userId;
    if (req.user.role === "staff") {
        // Agar staff hai to parentUser ke according test lana hai
        userId = req.user.parentUser;
    } else {
        userId = req.user._id;
    }

    const userRole = req.user.role;

    const { Name, final_price, Short_name, tat, category, Price, sampleType, method, instrument, parameters, interpretation, isDocumentedTest, user } = req.body;
    const normalizedShortName = typeof Short_name === "string" ? Short_name.trim() : "";
    const normalizedParameters = normalizeParameters(parameters, normalizedShortName);
    // const superAdmin = req.user.id // get the super admin id from token 

    if (!Name || !category || !final_price || !Price || !sampleType) {
        return res.status(400).json({ message: "Missing required fields" })
    }

    // checking if test is allready in database
    const allreadyExistedTest = await testSchema.findOne(
        {
            Name: Name,
            createdBy: userId
        }
    )

    if (allreadyExistedTest) {
        return res.status(400).json({ message: "This test is already Exists" });
    }

    const lastPanel = await testSchema
        .findOne({ createdBy: userId}) // optionally filter by tenant
        .sort({ order: -1 })             // highest order first
        .select('order');                // only fetch order field

    const nextOrder = lastPanel ? lastPanel.order + 1 : 1;

    const testCreated = await testSchema.create({
        Name,
        Short_name: normalizedShortName,
        category: category || "",
        Price,
        parameters: normalizedParameters,
        sampleType,
        method: method || "",
        instrument: instrument || "",
        interpretation: interpretation || "",
        order: nextOrder,
        isDocumentedTest: isDocumentedTest,
        final_price,
        tat: tat || "",
        createdBy: userId || "", // add the super admin id to the test
        originalTestId: null,
        isBaseTest: true,
        purchasedFromBaseTest: false,
        createdByRole: "superAdmin"
    })
    if (!testCreated) {
        return res.status(200).json({ message: "Failed to create test" })
    }

    // अगर staff का parentUser है तो उसे भी notify करें
    if (userRole === 'staff') {
        await SuperAdmin.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "test_create",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: "Staff created a new test",
                        testName: Name,
                        testId: testCreated._id
                    },
                    reference: {
                        model: "Test",
                        id: testCreated._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.json({
        status: 200,
        test: testCreated,
        message: "test is created sucessfully"
    })

})


// admin creating Test
const addingTesttenant = asyncHandler(async (req, res) => {
    // trim all values in req.body
    Object.entries(req.body).forEach(([key, value]) => {
        if (typeof value === "string") {
            req.body[key] = value.trim()
        }
    })


    let userId;
    if (req.user.role === "staff") {
        // Agar staff hai to parentUser ke according test lana hai
        userId = req.user.parentUser;
    } else {
        userId = req.user._id;
    }

    const tenantId = req.user.tenantId?._id; // safe optional chaining

    const { Name, final_price, Short_name, category, tat, Price, sampleType, method, instrument, parameters, interpretation, isDocumentedTest, user } = req.body;
    const normalizedShortName = typeof Short_name === "string" ? Short_name.trim() : "";
    const normalizedParameters = normalizeParameters(parameters, normalizedShortName);
    // const superAdmin = req.user.id // get the super admin id from token 

    if (!Name || !category || !final_price || !Price || !sampleType) {
        return res.status(400).json({ message: "Missing required fields" })
    }

    // checking if test is allready in database
    const allreadyExistedTest = await testSchema.findOne(
        {
            Name: Name,
            tenantId: tenantId
        }
    )

    if (allreadyExistedTest) {
        return res.status(400).json({ message: "This test is already Exists" });
    }

    const lastPanel = await testSchema
        .findOne({ createdBy: req.user._id }) // optionally filter by tenant
        .sort({ order: -1 })             // highest order first
        .select('order');                // only fetch order field

    const nextOrder = lastPanel ? lastPanel.order + 1 : 1;

    const testCreated = await testSchema.create({
        Name,
        Short_name: normalizedShortName,
        category: category || "",
        Price,
        parameters: normalizedParameters,
        sampleType,
        method: method || "",
        instrument: instrument || "",
        interpretation: interpretation || "",
        order: nextOrder,
        isDocumentedTest: isDocumentedTest,
        final_price,
        tat: tat || "",
        createdBy: userId || "", // add the super admin id to the test
        originalTestId: null,
        isBaseTest: true,
        purchasedFromBaseTest: false,
        tenantId: tenantId,
        createdByRole: "admin"
    })
    if (!testCreated) {
        return res.status(200).json({ message: "Failed to create test" })
    }

    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "test_create",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: "Staff created a new test",
                        testName: Name,
                        testId: testCreated._id
                    },
                    reference: {
                        model: "Test",
                        id: testCreated._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.json({
        status: 200,
        test: testCreated,
        message: "test is created sucessfully"
    })
})

// create superAdmin sample correct 
const addsample = async (req, res) => {
    const { Name, user } = req.body;
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }
    if (!Name) {
        return res.status(400).json({ message: "! please enter Name" })
    }

    const duplicate = await sampleSchema.findOne({
        createdBy: userId,
        Name: Name,
        isBaseSample: true,
    })

    if (duplicate) {
        return res.status(400).json({ message: "! This sampletype is already present" })
    }

    const createddoc = await sampleSchema.create({
        tenantId: null,
        Name: Name,
        createdBy: userId,
        isBaseSample: true,
        purchasedFromBaseSample: false,
        createdByRole: "superAdmin",
    })

    if (!createddoc) {
        return res.status(401).json({ message: "! Something went wrong, please try again" })
    }

    if (req.user.role === 'staff') {
        await SuperAdmin.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "test_create",
                    details: {
                        staffId: userId,
                        staffName: req.user.fullName,
                        action: "Staff created a new Sample",
                        sampleName: Name,
                        sampleId: createddoc._id
                    },
                    reference: {
                        model: "sample",
                        id: createddoc._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.status(200).json({ message: "sample added successfully" });

}

// create admin sample correct 
const addsampleadmin = async (req, res) => {
    const { Name, user } = req.body;
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }
    if (!Name) {
        return res.status(400).json({ message: "! please enter Name" })
    }

    const tid = req.user.tenantId._id;

    const duplicate = await sampleSchema.findOne({
        tenantId: tid,
        Name: Name
    })

    if (duplicate) {
        return res.status(400).json({ message: "! This sampletype is already present" })
    }

    const createddoc = await sampleSchema.create({
        tenantId: tid,
        createdBy: userId,
        Name: Name,
        isBaseSample: true,
        purchasedFromBaseSample: false,
        createdByRole: "admin"
    })

    if (!createddoc) {
        return res.status(401).json({ message: "! Something went wrong, please try again" })
    }
    if (req.user.role === 'staff') {

        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "test_create",
                    details: {
                        staffId: userId,
                        staffName: req.user.fullName,
                        action: "Staff created a new Sample",
                        sampleName: Name,
                        sampleId: createddoc._id
                    },
                    reference: {
                        model: "sample",
                        id: createddoc._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.status(200).json({ message: "sample added successfully" });

}

// superAdmin fetch samples correct 
const fetchsample = async (req, res) => {

    let query = {};
    if (req.user.role === 'staff') {
        query.createdBy = req.user.parentUser
    }
    else {
        query.createdBy = req.user._id
    }

    const samples = await sampleSchema.find(query)
        .select("Name createdBy tenantId isBaseSample originalSampleId purchasedFromBaseSample createdByRole createdAt updatedAt")
        .sort({ Name: 1, createdAt: -1 })
        .lean();

    if (!samples) {
        return res.status(500).json({ message: "! No samples found" })
    }

    return res.status(200).json({ message: "sample added successfully", data: samples });
}

// admin fetch samples correct 
const fetchsampleadmin = async (req, res) => {

    const samples = await sampleSchema.find({
        tenantId: req.user.tenantId._id
    })
        .select("Name createdBy tenantId isBaseSample originalSampleId purchasedFromBaseSample createdByRole createdAt updatedAt")
        .sort({ Name: 1, createdAt: -1 })
        .lean();

    if (!samples) {
        return res.status(500).json({ message: "! No samples found" })
    }

    return res.status(200).json({ message: "sample added successfully", data: samples });
}
// Todo: Update test interpretation
const updateTestInterpretation = asyncHandler(async (req, res) => {

    const { testId, interpretation } = req.body;
let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }
    const tid = req.user.tenantId?._id; // safe optional chaining

    if (!testId || !interpretation) {
        throw new ApiError(400, "Test ID and interpretation are required.");
    }

    // Find the test by testId and update the interpretation
    const updatedTest = await testSchema.findOneAndUpdate(
        {
            _id: testId,
            tenantId: tid,
        },
        { interpretation: interpretation }, // Only update the interpretation field
        { new: true } // Return the updated document
    );

    if (!updatedTest) {
        throw new ApiError(404, "Test not found.");
    }

      // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
        await SuperAdmin.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "other",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: "Staff updated a Interpretation of Test",
                        testName: updatedTest.Name,
                        testId: updatedTest._id
                    },
                    reference: {
                        model: "Test",
                        id: updatedTest._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.json({
        status: 200,
        test: updatedTest,
        message: "Test interpretation updated successfully"
    });
});

const updateTestOrder = asyncHandler(async (req, res) => {
    const { updatedOrder } = req.body;
    const tid = req.user.tenantId._id;
    if (!Array.isArray(updatedOrder) || updatedOrder.length === 0) {
        throw new ApiError(400, "Invalid or empty order data");
    }

    try {
        const bulkOperations = await Promise.all(updatedOrder.map(async (orderData) => {
            let { id, order } = orderData;

            // If id is a valid MongoDB ObjectId, use it directly
            if (mongoose.isValidObjectId(id)) {
                id = new mongoose.Types.ObjectId(id); // Convert string ObjectId to ObjectId type
            }
            // If id is a numeric value (e.g., '4'), map it to ObjectId by querying the database
            else if (typeof id !== "number") {
                const idofNumber = parseInt(id);
                const test = await testSchema.findOne({
                    order: idofNumber,
                    tenantId: tid
                });
                if (!test) {
                    throw new ApiError(400, `Test with order ${id} not found`);
                }
                id = test._id; // Use the found ObjectId
            }
            else {
                throw new ApiError(400, `Invalid ObjectId: ${id}`);
            }

            return {
                updateOne: {
                    filter: { _id: id },
                    update: { order },
                },
            };
        }));

        // Execute the bulk write operation
        await testSchema.bulkWrite(bulkOperations);

        res.json({
            status: 200,
            message: "Test order updated successfully",
        });
    } catch (error) {
        console.error("Error updating test order:", error);
        throw new ApiError(500, "Failed to update test order");
    }
});
const updateTestOrdersuper = asyncHandler(async (req, res) => {
    const { updatedOrder } = req.body;
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser;
    } else {
        userId = req.user._id;
    }
    if (!Array.isArray(updatedOrder) || updatedOrder.length === 0) {
        throw new ApiError(400, "Invalid or empty order data");
    }

    try {
        const bulkOperations = await Promise.all(updatedOrder.map(async (orderData) => {
            let { id, order } = orderData;

            // If id is a valid MongoDB ObjectId, use it directly
            if (mongoose.isValidObjectId(id)) {
                id = new mongoose.Types.ObjectId(id); // Convert string ObjectId to ObjectId type
            }
            // If id is a numeric value (e.g., '4'), map it to ObjectId by querying the database
            else if (typeof id !== "number") {
                const idofNumber = parseInt(id);
                const test = await testSchema.findOne({
                    order: idofNumber,
                    createdBy: userId
                });
                if (!test) {
                    throw new ApiError(400, `Test with order ${id} not found`);
                }
                id = test._id; // Use the found ObjectId
            }
            else {
                throw new ApiError(400, `Invalid ObjectId: ${id}`);
            }

            return {
                updateOne: {
                    filter: { _id: id },
                    update: { order },
                },
            };
        }));

        // Execute the bulk write operation
        await testSchema.bulkWrite(bulkOperations);

        res.json({
            status: 200,
            message: "Test order updated successfully",
        });
    } catch (error) {
        console.error("Error updating test order:", error);
        throw new ApiError(500, "Failed to update test order");
    }
});

// SuperAdmin Test Edit
const editTest = asyncHandler(async (req, res) => {
    const { _id, Name, final_price, Short_name, category, tat, Price, sampleType, method, instrument, interpretation, parameters } = req.body;
    const normalizedShortName = typeof Short_name === "string" ? Short_name.trim() : "";
    const normalizedParameters = normalizeParameters(parameters, normalizedShortName);

    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }
    if (!Name || !final_price || !normalizedShortName || !category || !Price || !sampleType) {
        return res.status(401).json({ message: "missing required fields", status: "error" })
    }
    const currentTest = await testSchema.findById({
        createdBy: userId,
        _id
    });

    if (!currentTest) {
        return res.status(401).json({ message: "something went wrong, Test not found", status: "error" });
    }

    const editedTest = await testSchema.findOneAndUpdate(
        {
            _id
        },
        {
            Name,
            Short_name: normalizedShortName,
            category: category || "",
            Price,
            parameters: normalizedParameters,
            sampleType,
            method: method || "",
            tat: tat || "",
            instrument: instrument || "",
            interpretation: interpretation || "",
            final_price
        },
        { new: true }
    );

    if (!editedTest) {
        return res.status(402).json({ message: "Something went wrong, please try again", status: "error" });
    }

    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
        await SuperAdmin.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "test_create",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: "Staff updated a Test",
                        testName: Name,
                        testId: editedTest._id
                    },
                    reference: {
                        model: "Test",
                        id: editedTest._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.status(200).json({ message: "test edited successfully", status: "success" });
});

// Admin Test Edit
const editTesttenant = asyncHandler(async (req, res) => {
    const { _id, final_price, Short_name, category, tat, Price, sampleType, method, instrument, interpretation, parameters } = req.body;
    const normalizedShortName = typeof Short_name === "string" ? Short_name.trim() : "";
    const normalizedParameters = normalizeParameters(parameters, normalizedShortName);

    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }

    const tid = req.user.tenantId._id;

    if (!final_price || !normalizedShortName || !category || !Price || !sampleType) {
        return res.status(401).json({ message: "missing required fields", status: "error" })
    }

    const currentTest = await testSchema.findById({
        tenantId: tid,
        createdBy: userId,
        _id
    });
    if (!currentTest) {
        return res.status(401).json({ message: "something went wrong, Test not found", status: "error" });
    }

    const editedTest = await testSchema.findOneAndUpdate(
        {
            _id
        },
        {
            Short_name: normalizedShortName,
            category: category || "",
            Price,
            parameters: normalizedParameters,
            sampleType,
            method: method || "",
            tat: tat || "",
            instrument: instrument || "",
            interpretation: interpretation || "",
            final_price,
        },
        { new: true }
    );

    if (!editedTest) {
        return res.status(402).json({ message: "Something went wrong, please try again", status: "error" });
    }

    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "test_create",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: "Staff updated a Test",
                        testName: Short_name,
                        testId: editedTest._id
                    },
                    reference: {
                        model: "Test",
                        id: editedTest._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.status(200).json({ message: "test edited successfully", status: "success" });
});

const allTest = asyncHandler(async (req, res) => {


    let query = {
        createdByRole: "superAdmin"
    };

    if (req.user.role === "staff") {
        // Agar staff hai to parentUser ke according test lana hai
        query.createdBy = req.user.parentUser;

    } else {
        // Warna khud ke according test lana hai
        query.createdBy = req.user._id;
    }

    const allrecievedTest = await testSchema.find(query);

    if (!allrecievedTest) {
        throw new ApiError(400, "Something went wrong while fetching details")
    }

    return res.json(allrecievedTest)

})

// for test category creation
const testCate = asyncHandler(async (req, res) => {

    const { catName } = req.body
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }

    const fetchedcategory = await categorydb.findOne({
        createdBy: userId,
        category: catName
    });

    if (fetchedcategory) {
        return res.json({ message: `'${catName}' allready present`, type: "error" });
    }

    if (!catName && typeof catName !== "string") {
        return res.json({ message: "please enter category Name", type: "auth" });
    }

    const incremented = await Counter.findOneAndUpdate(
        { _id: "orderId" },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true }
    )

    console.log(incremented)

    if (!incremented) {
        return res.json({ message: "Invalid orderId, please try again", type: "error" });
    }

    const newCategory = await categorydb.create({
        orderId: incremented.sequence_value,
        category: catName,
        createdBy: userId,
        tenantId: null
    })

    if (!newCategory) {
        return res.json({ message: "Connection error, please check your internet connection", type: "error" });
    }

    return res.json({ message: "category added successfully", type: "success" });

})

// const testCateadmin = asyncHandler(async (req, res) => {

//     const { catName } = req.body

//     const tenantid = req.user.tenantId._id;

//     const fetchedcategory = await categorydb.findOne({
//         tenantId: tenantid,
//         createdBy: req.user._id,
//         category: catName
//     });

//     if (fetchedcategory) {
//         return res.json({ message: `'${catName}' allready present`, type: "error" });
//     }

//     if (!catName && typeof catName !== "string") {
//         return res.json({ message: "please enter category Name", type: "auth" });
//     }

//     const incremented = await Counter.findOneAndUpdate(
//         { _id: "orderId" },
//         { $inc: { sequence_value: 1 } },
//         { new: true, upsert: true }
//     )

//     console.log(incremented)

//     if (!incremented) {
//         return res.json({ message: "Invalid orderId, please try again", type: "error" });
//     }

//     const newCategory = await categorydb.create({
//         orderId: incremented.sequence_value,
//         category: catName,
//         createdBy: req.user._id,
//         tenantId: tenantid
//     })

//     if (!newCategory) {
//         return res.json({ message: "Connection error, please check your internet connection", type: "error" });
//     }

//     return res.json({ message: "category added successfully", type: "success" });

// })

// for fetc all test category
const getAllTestCate = asyncHandler(async (req, res) => {
    let query = {};

    if (req.user.role === 'staff') {
        query.createdBy = req.user.parentUser;
    }
    else {
        query.createdBy = req.user._id
    }
    const allrecievedTest = await categorydb.find(query)

    if (!allrecievedTest) {
        throw new ApiError(400, "Something went wrong while fetching details")
    }
    return res.json(new ApiResponse(201, allrecievedTest, { success: true }))
})

// for fetc all test category
const getAllTestCateadmin = asyncHandler(async (req, res) => {
    const allrecievedTest = await categorydb.find({
        tenantId: req.user.tenantId._id
    })
    if (!allrecievedTest) {
        throw new ApiError(400, "Something went wrong while fetching details")
    }
    return res.json(new ApiResponse(201, allrecievedTest, { success: true }))
})
//fetch one category base on id
const getOneTestCate = asyncHandler(async (req, res) => {
    const _id = req.query._id;
    const oneTest = await categorydb.findById(_id)
    if (!oneTest) {
        throw new ApiError(400, "Something went wrong while fetching details")
    }
    return res.json(new ApiResponse(201, oneTest, { success: true }))
});

// fetch one test base on id
const getOneTest = asyncHandler(async (req, res) => {
    const { Name } = req.query
    const oneTest = await testSchema.findById({ _id: Name })
    if (!oneTest) {
        throw new ApiError(400, "Something went wrong while fetching details")
    }
    return res.json(new ApiResponse(201, oneTest, { success: true }))
})


// update one category base on id
const updateTestCate = asyncHandler(async (req, res) => {
    const { _id } = req.query
    const { catName } = req.body
    let category = catName

    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }

    const duplicateTest = await categorydb.findOne({
        category: category,
        createdBy: userId
    });
    if (duplicateTest) {
        return res.json({
            message: `${category} already present`,
            type: "auth"
        });
    }
    const updatedTest = await categorydb.findByIdAndUpdate(_id, { category }, { new: true })

    if (!updatedTest) {
        return res.json({
            message: `please check your internet connection`,
            type: "error"
        });
    }
    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
        await SuperAdmin.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "test_create",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: "Staff update a Category",
                        categoryName: category,
                        categoryId: updatedTest._id
                    },
                    reference: {
                        model: "unit",
                        id: updatedTest._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.json({ message: `edited successfully`, type: "success" });
})
const updateTestCateadmin = asyncHandler(async (req, res) => {
    const { _id } = req.query
    const { catName } = req.body

    let category = catName
    const duplicateTest = await categorydb.findOne({
        category: category,
        tenantId: req.user.tenantId._id
    });
    if (duplicateTest) {
        return res.json({
            message: `${category} already present`,
            type: "auth"
        });
    }
    const updatedTest = await categorydb.findByIdAndUpdate(_id, { category }, { new: true })

    if (!updatedTest) {
        return res.json({
            message: `please check your internet connection`,
            type: "error"
        });
    }
    if (req.user.role === 'staff') {
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "test_create",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: "Staff update a Category",
                        categoryName: category,
                        categoryId: updatedTest._id
                    },
                    reference: {
                        model: "unit",
                        id: updatedTest._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.json({ message: `edited successfully`, type: "success" });
})

//for test category edit
const editTestCate = asyncHandler(async (req, res) => {

    const { category } = req.params

    if (!category) {
        throw new ApiError(400, "an error occured when sending variables through url")
    }

    const { catName } = req.body

    if (!catName) {
        throw new ApiError(400, "please enter Name")
    }

    const editedCategory = await categorydb.findOneAndUpdate(
        { category: category },
        {
            $set:
                { category: catName }
        },
        { new: true }
    )

    if (!editedCategory) {
        throw new ApiError(400, "something went wrong")
    }

    return res.json(new ApiResponse(200, { editedCategory }, "category edited successfully"))

})

const editdefaultresult = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { dataObject, tname, text, selectType } = req.body;

        console.log("Request data:", { dataObject, tname, text });

        // Input validation
        if (!tname) {
            return res.status(400).json({
                success: false,
                message: "Parameter name (tname) is required"
            });
        }

        if (!dataObject && !text) {
            return res.status(400).json({
                success: false,
                message: "Either dataObject or text must be provided for update"
            });
        }

        // Check if user has tenantId
        if (!req.user.tenantId || !req.user.tenantId._id) {
            return res.status(400).json({
                success: false,
                message: "Invalid tenant information"
            });
        }

        const tenantId = req.user.tenantId._id;

        // First check if the test with the parameter exists
        const existingTest = await testSchema.findOne({
            // tenantId: tenantId,
            "parameters.Para_name": tname
        }).session(session);

        if (!existingTest) {
            return res.status(404).json({
                success: false,
                message: `Test parameter '${tname}' not found for this tenant`
            });
        }

        console.log("Found existing test:", existingTest._id);

        // Prepare update operations
        const updateOperations = {};
        let updateFields = [];

        // Add text update if provided
        if (text !== undefined && text !== null && selectType === "text") {
            updateOperations["parameters.$.text"] = text;
            updateFields.push("text");
        }

        // Add NormalValue update if provided
        if (dataObject !== undefined && dataObject !== null && selectType !== "text") {
            updateOperations["parameters.$.NormalValue"] = dataObject;
            updateOperations["parameters.$.text"] = "";
            updateFields.push("NormalValue");
        }

        // Perform single atomic update operation
        const updatedTest = await testSchema.findOneAndUpdate(
            {
                tenantId: tenantId,
                "parameters.Para_name": tname
            },
            {
                $set: updateOperations
            },
            {
                new: true,
                runValidators: true,
                session: session
            }
        );

        if (!updatedTest) {
            throw new ApiError(500, "Failed to update test parameter");
        }

        // Find the specific updated parameter for response
        const updatedParameter = updatedTest.parameters.find(
            param => param.Para_name === tname
        );

        if (!updatedParameter) {
            throw new ApiError(500, "Updated parameter not found in response");
        }

        // Log the update activity
        const activityLog = {
            activityType: "parameter_update",
            details: {
                userId: req.user._id,
                userName: req.user.fullName || req.user.username,
                testId: updatedTest._id,
                testName: updatedTest.Name,
                parameterName: tname,
                updatedFields: updateFields,
                oldValues: {},
                newValues: {}
            },
            timestamp: new Date()
        };

        // Add old and new values to activity log
        if (text !== undefined) {
            activityLog.details.newValues.text = text;
        }
        if (dataObject !== undefined) {
            activityLog.details.newValues.NormalValue = dataObject;
        }

        console.log("Update successful for parameter:", tname);

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: `Parameter '${tname}' updated successfully`,
            data: {
                testId: updatedTest._id,
                testName: updatedTest.Name,
                updatedParameter: {
                    Para_name: updatedParameter.Para_name,
                    text: updatedParameter.text,
                    NormalValue: updatedParameter.NormalValue
                },
                updatedFields: updateFields,
                lastModified: new Date()
            }
        });

    } catch (error) {
        // Rollback transaction on error
        await session.abortTransaction();
        session.endSession();

        console.error("Error in editdefaultresult:", error);

        // Handle different types of errors
        if (error instanceof ApiError) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message
            }));

            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: validationErrors
            });
        }

        // Handle MongoDB duplicate key errors
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Duplicate entry error",
                error: "A parameter with similar data already exists"
            });
        }

        // Handle MongoDB connection errors
        if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
            return res.status(503).json({
                success: false,
                message: "Database connection error. Please try again later."
            });
        }

        // Generic error handler
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating parameter",
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack
            } : undefined
        });
    }
});


const findTestcontroller = asyncHandler(async (req, res) => {
    const { name, shortName } = req.params;

    // if(!(name || shortName)) {
    //     throw new ApiError(400, "please give name or shortname")
    // }

    const tests = await testSchema.findOne({
        Name: name
        // $or: [
        //     {Name: name},
        //     {Short_name: shortName}
        // ]
    })

    if (!tests) {
        throw new ApiError(400, "test not found")
    }

    return res.json(tests)

})

const updateTestcontroller = asyncHandler(async (req, res) => {

    const { name, shortName } = req.params;
    const { Name, Short_name, category, Price, sampleType, method, instrument, interpretation, parameters, NormalValue } = req.body;

    const updatedtests = await testSchema.findOneAndUpdate(
        {
            $or: [
                { Name: name },
                { Short_name: shortName }
            ]
        },
        {
            $set: {
                Name: Name,
                Short_name: Short_name,
                category: category || "",
                Price,
                parameters: parameters || "",
                sampleType,
                method: method || "",
                instrument: instrument || "",
                interpretation,
                defaultresult: NormalValue || ""
            }
        },
        { new: true } // `upsert: true` will create a new document if not found
    );


    if (!updatedtests) {
        throw new ApiError(400, "test not updated")
    }

    return res.json(updatedtests)

})
const addUnit = asyncHandler(async (req, res) => {
    const { unit } = req.body;
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    }
    else {
        userId = req.user._id
    }
    const unitExists = await unitdb.findOne({
        createdBy: userId,
        unit: unit,

    });
    if (unitExists) {
        throw new ApiError("Unit already exists");
    }
    const newUnit = new unitdb({
        createdBy: userId,
        unit,
        tenantId: null,
        isBaseUnit: true,
        purchasedFromBaseUnit: false,
        createdByRole: "superAdmin"
    });
    await newUnit.save();

    if (req.user.role === 'staff') {
        await SuperAdmin.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "test_create",
                    details: {
                        staffId: userId,
                        staffName: req.user.fullName,
                        action: "Staff created a new Unit",
                        unitName: unit,
                        unitId: newUnit._id
                    },
                    reference: {
                        model: "unit",
                        id: newUnit._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    return res.status(201).json({ unit: newUnit.unit });
});

const addUnitadmin = asyncHandler(async (req, res) => {

    const { unit } = req.body;
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    }
    else {
        userId = req.user._id
    }

    const tid = req.user.tenantId._id;
    const unitExists = await unitdb.findOne({
        tenantId: tid,
        unit: unit
    });
    if (unitExists) {
        throw new ApiError("Unit already exists");
    }
    const newUnit = new unitdb({
        tenantId: tid,
        createdBy: userId,
        unit,
        isBaseUnit: true,
        purchasedFromBaseUnit: false,
        createdByRole: "admin"
    });
    await newUnit.save();
    if (req.user.role === 'staff') {
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "test_create",
                    details: {
                        staffId: userId,
                        staffName: req.user.fullName,
                        action: "Staff created a new Unit",
                        unitName: unit,
                        unitId: newUnit._id
                    },
                    reference: {
                        model: "unit",
                        id: newUnit._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }


    return res.status(201).json({ unit: newUnit.unit });
});

const getUnits = asyncHandler(async (req, res) => {
    let query = {};

    if (req.user.role === 'staff') {
        query.createdBy = req.user.parentUser
    }
    else {
        query.createdBy = req.user._id
    }
    const units = await unitdb.find(query).sort({ unit: 1 });

    return res.status(200).json({ units });
});

const tenantTest = asyncHandler(async (req, res) => {

    const tenantId = req.user.tenantId._id; // Assuming tenant is logged in

    try {
        const tests = await testSchema.find({
            tenantId: tenantId,
        });

        return res.status(200).json({
            status: 200,
            message: "Tests fetched successfully",
            count: tests.length,
            tests,
        });
    } catch (error) {
        return res
            .status(500)
            .json({ message: "Failed to fetch tests", error: error.message });
    }
});
const assignModelsToFranchisee = asyncHandler(async (req, res) => {
    let session; // created later, after validation
    try {
        const {
            franchiseeId,
            testIds = [],
            panelIds = [],
            packageIds = [],
            categoryIds = [],
            unitIds = [],
            sampleTypeIds = []
        } = req.body;

        if (!franchiseeId) {
            return res.status(400).json({ success: false, message: "Franchisee ID is required." });
        }

        // Pre-validate the tenant before starting a transaction so we don't leave open
        // transactions when returning early due to bad input.
        const tenant = await Tenant.findById(franchiseeId);
        if (!tenant || !tenant.adminDetails?.userId) {
            return res.status(404).json({ success: false, message: "Franchisee not found." });
        }

        // Start a session only after basic validation passes
        session = await mongoose.startSession();
        session.startTransaction();

        // If you need the tenant inside the transaction for consistent reads, re-fetch using the session.
        const tenantInSession = await Tenant.findById(franchiseeId).session(session);
        const createdBy = tenantInSession?.adminDetails?.userId || tenant.adminDetails.userId;

        let assignedCounts = {
            tests: 0,
            panels: 0,
            packages: 0,
            categories: 0,
            units: 0,
            sampleTypes: 0
        };

        // === STEP 4: CATEGORIES ===
        if (categoryIds && categoryIds.length > 0) {
            const [assignedByOriginalId, assignedByName] = await Promise.all([
                categorydb.find({
                    tenantId: franchiseeId,
                    originalCategoryId: { $in: categoryIds }
                }).session(session).distinct('originalCategoryId'),

                categorydb.find({
                    tenantId: franchiseeId
                }).session(session).distinct('category')
            ]);

            const candidateCategories = await categorydb.find({
                _id: { $in: categoryIds },
                $or: [
                    { isBaseCategory: true },
                    { isBaseCategory: { $exists: false } }  // Field exist नहीं करता
                ]
            }).session(session);

            const newCategories = candidateCategories.filter(cat =>
                !assignedByOriginalId.includes(cat._id) &&
                !assignedByName.includes(cat.category)
            );

            if (newCategories.length > 0) {
                // Get next orderId for categories
                const lastCategory = await categorydb
                    .findOne({ tenantId: franchiseeId })
                    .sort({ orderId: -1 })
                    .select('orderId')
                    .session(session);

                let nextCategoryOrder = lastCategory ? lastCategory.orderId + 1 : 1;

                const copiedCategories = newCategories.map(cat => {
                    const { _id, ...rest } = cat.toObject();
                    return {
                        ...rest,
                        _id: new mongoose.Types.ObjectId(),
                        orderId: nextCategoryOrder++,
                        createdBy,
                        tenantId: franchiseeId,
                        isBaseCategory: false,
                        purchasedFromBaseCategory: true,
                        originalCategoryId: cat._id,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                });

                await categorydb.insertMany(copiedCategories, { session });
                assignedCounts.categories = copiedCategories.length;
            }
        }

        // === STEP 5: UNITS ===
        if (unitIds && unitIds.length > 0) {
            const [assignedByOriginalId, assignedByName] = await Promise.all([
                unitdb.find({
                    tenantId: franchiseeId,
                    originalUnitId: { $in: unitIds }
                }).session(session).distinct('originalUnitId'),

                unitdb.find({
                    tenantId: franchiseeId
                }).session(session).distinct('unit') // Adjust field name as per your schema
            ]);

            const candidateUnits = await unitdb.find({
                _id: { $in: unitIds },
                isBaseUnit: true,
            }).session(session);

            const newUnits = candidateUnits.filter(unit =>
                !assignedByOriginalId.includes(unit._id) &&
                !assignedByName.includes(unit.unit) // Adjust field name
            );

            if (newUnits.length > 0) {
                const copiedUnits = newUnits.map(unit => {
                    const { _id, ...rest } = unit.toObject();
                    return {
                        ...rest,
                        _id: new mongoose.Types.ObjectId(),
                        createdBy,
                        tenantId: franchiseeId,
                        isBaseUnit: false,
                        purchasedFromBaseUnit: true,
                        originalUnitId: unit._id,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                });

                await unitdb.insertMany(copiedUnits, { session });
                assignedCounts.units = copiedUnits.length;
            }
        }

        // === STEP 6: SAMPLE TYPES ===
        if (sampleTypeIds && sampleTypeIds.length > 0) {
            const [assignedByOriginalId, assignedByName] = await Promise.all([
                sampleSchema.find({
                    tenantId: franchiseeId,
                    originalSampleId: { $in: sampleTypeIds }
                }).session(session).distinct('originalSampleId'),

                sampleSchema.find({
                    tenantId: franchiseeId
                }).session(session).distinct('Name')
            ]);

            const candidateSamples = await sampleSchema.find({
                _id: { $in: sampleTypeIds },
                isBaseSample: true,
            }).session(session);

            const newSamples = candidateSamples.filter(sample =>
                !assignedByOriginalId.includes(sample._id) &&
                !assignedByName.includes(sample.Name)
            );

            if (newSamples.length > 0) {
                const copiedSamples = newSamples.map(sample => {
                    const { _id, ...rest } = sample.toObject();
                    return {
                        ...rest,
                        _id: new mongoose.Types.ObjectId(),
                        createdBy,
                        tenantId: franchiseeId,
                        isBaseSample: false,
                        purchasedFromBaseSample: true,
                        originalSampleId: sample._id,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                });

                await sampleSchema.insertMany(copiedSamples, { session });
                assignedCounts.sampleTypes = copiedSamples.length;
            }
        }

        // === STEP 1: TESTS (IMPROVED DUPLICATE DETECTION) ===
        if (testIds && testIds.length > 0) {
            // Get both originalTestId and Name-based duplicates
            const [assignedByOriginalId, assignedByName] = await Promise.all([
                testSchema.find({
                    tenantId: franchiseeId,
                    originalTestId: { $in: testIds }
                }).session(session).distinct('originalTestId'),

                // Get existing test names for this tenant
                testSchema.find({
                    tenantId: franchiseeId
                }).session(session).distinct('Name')
            ]);

            // Get base tests that aren't already assigned
            const allCandidateTests = await testSchema.find({
                _id: { $in: testIds },
            }).session(session);

            // Step 2: Split between baseTest & non-baseTest
            const candidateTests = allCandidateTests.filter(t => {
                if (t.createdByRole === 'admin' || t.createdByRole === 'superAdmin' || t.isBaseTest === true) {
                    return true; // सबको allow
                } else {
                    // Already assigned to someone → treat as cloned
                    return t.isBaseTest === false;
                }
            });
            //console.log(candidateTests.length)
            // Filter out tests that would cause duplicates
            // Normalize assigned ids/names to Sets for O(1) lookups
            const assignedOriginalSet = new Set(assignedByOriginalId.map(id => String(id)));
            const assignedNameSet = new Set(assignedByName.map(n => String(n)));

            const newTests = candidateTests.filter(test =>
                !assignedOriginalSet.has(String(test._id)) &&
                !assignedNameSet.has(String(test.Name))
            );

            if (newTests.length > 0) {
                const copiedTests = [];

                // Use for...of so we can await inside the loop
                for (const test of newTests) {
                    const { _id, ...rest } = test.toObject();
                    let newCategory = test.category;

                    // Normalize incoming category which can be:
                    // - a plain ObjectId/string
                    // - a populated object { _id, category }
                    // - an array containing a populated object
                    // We want to set newCategory to the franchisee's category _id when possible,
                    // otherwise use the original category id/string.
                    try {
                        // If category is an array, pick the first meaningful entry
                        let catEntry = null;
                        if (Array.isArray(test.category) && test.category.length > 0) {
                            catEntry = test.category[0];
                        } else if (test.category && typeof test.category === 'object') {
                            catEntry = test.category;
                        }

                        if (catEntry) {
                            // If provided object has an _id, try to find franchisee mapping by originalCategoryId
                            if (catEntry._id) {
                                const franchiseeCategoryByOriginal = await categorydb.findOne({
                                    tenantId: franchiseeId,
                                    originalCategoryId: catEntry._id
                                }).session(session);
                                if (franchiseeCategoryByOriginal) {
                                    newCategory = franchiseeCategoryByOriginal;
                                } else {
                                    // fallback to using the provided _id
                                    newCategory = catEntry;
                                }
                            } else if (catEntry.category) {
                                // If object has 'category' (name), try to find by name
                                const franchiseeCategoryByName = await categorydb.findOne({
                                    tenantId: franchiseeId,
                                    category: catEntry.category
                                }).session(session);
                                if (franchiseeCategoryByName) {
                                    newCategory = franchiseeCategoryByName;
                                } else {
                                    // fallback to the category name (not ideal but keeps original behavior)
                                    newCategory = catEntry.category;
                                }
                            }
                        } else {
                            // If category is a primitive (string/ObjectId), keep as-is
                            newCategory = test.category;
                        }
                    } catch (e) {
                        // If anything goes wrong, fallback to original category value
                        console.warn('Category normalization failed, using original value', e);
                        newCategory = test.category;
                    }
                    // Differentiate between SuperAdmin base-tests and admin-created tests
                    if (test.createdByRole === 'superAdmin') {
                        // SuperAdmin base test -> create a tenant-scoped copy marked as purchased
                        copiedTests.push({
                            ...rest,
                            _id: new mongoose.Types.ObjectId(),
                            createdBy,
                            category: newCategory,
                            tenantId: franchiseeId,
                            assignedPrices: [], // reset assignedPrices
                            isBaseTest: false,
                            purchasedFromBaseTest: true,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                    } else if (test.createdByRole === 'admin') {
                        // Admin-created test -> create as baseTest for tenant but keep originalTestId linkage
                        copiedTests.push({
                            ...rest,
                            _id: new mongoose.Types.ObjectId(),
                            createdBy,
                            tenantId: franchiseeId,
                            isBaseTest: true,
                            assignedPrices: [], // reset assignedPrices
                            purchasePrice: [],
                            purchasedFromBaseTest: false,
                            originalTestId: test._id,
                            category: newCategory,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                    }
                    // If neither condition matches we simply skip (no push)
                }

                if (copiedTests.length > 0) {
                    await testSchema.insertMany(copiedTests, { session });
                    assignedCounts.tests = copiedTests.length;

                    // Update base tests with purchasedBy info
                    await Promise.all(
                        newTests.map(t =>
                            testSchema.findByIdAndUpdate(t._id, {
                                $push: {
                                    purchasedBy: {
                                        tenantId: franchiseeId,
                                        purchasePrice: 1,
                                        purchaseDate: new Date()
                                    }
                                }
                            }, { session })
                        )
                    );
                }
            }
        }

        // === STEP 2: PANELS (IMPROVED DUPLICATE DETECTION & ID MAPPING) ===
        if (panelIds && panelIds.length > 0) {
            const [assignedByOriginalId, assignedByName] = await Promise.all([
                addPannel.find({
                    tenantId: franchiseeId,
                    originalPanelId: { $in: panelIds }
                }).session(session).distinct('originalPanelId'),

                addPannel.find({
                    tenantId: franchiseeId
                }).session(session).distinct('name')
            ]);

            const allCandidatePanels = await addPannel.find({
                _id: { $in: panelIds },
            }).session(session);

            const candidatePanels = allCandidatePanels.filter(t => {
                if (t.createdByRole === 'admin' || t.createdByRole === 'superAdmin' || t.isBasePanel === true) {
                    return true; // सबको allow
                } else {
                    return t.isBasePanel === false
                }
            })

            // Use sets for faster lookups
            const assignedPanelOriginalSet = new Set(assignedByOriginalId.map(id => String(id)));
            const assignedPanelNameSet = new Set(assignedByName.map(n => String(n)));

            const newPanels = candidatePanels.filter(panel =>
                !assignedPanelOriginalSet.has(String(panel._id)) &&
                !assignedPanelNameSet.has(String(panel.name))
            );

            if (newPanels.length > 0) {
                const copiedPanels = [];

                for (const panel of newPanels) {
                    const { _id, ...rest } = panel.toObject();

                    // Map category to franchisee's category id if needed
                    let newCategory = panel.category;

                    // Normalize incoming category which can be:
                    // - a plain ObjectId/string
                    // - a populated object { _id, category }
                    // - an array containing a populated object
                    // We want to set newCategory to the franchisee's category _id when possible,
                    // otherwise use the original category id/string.
                    try {
                        // If category is an array, pick the first meaningful entry
                        let catEntry = null;
                        if (Array.isArray(panel.category) && panel.category.length > 0) {
                            catEntry = panel.category[0];
                        } else if (panel.category && typeof panel.category === 'object') {
                            catEntry = panel.category;
                        }

                        if (catEntry) {
                            // If provided object has an _id, try to find franchisee mapping by originalCategoryId
                            if (catEntry._id) {
                                const franchiseeCategoryByOriginal = await categorydb.findOne({
                                    tenantId: franchiseeId,
                                    originalCategoryId: catEntry._id
                                }).session(session);
                                if (franchiseeCategoryByOriginal) {
                                    newCategory = franchiseeCategoryByOriginal;
                                } else {
                                    // fallback to using the provided _id
                                    newCategory = catEntry;
                                }
                            } else if (catEntry.category) {
                                // If object has 'category' (name), try to find by name
                                const franchiseeCategoryByName = await categorydb.findOne({
                                    tenantId: franchiseeId,
                                    category: catEntry.category
                                }).session(session);
                                if (franchiseeCategoryByName) {
                                    newCategory = franchiseeCategoryByName;
                                } else {
                                    // fallback to the category name (not ideal but keeps original behavior)
                                    newCategory = catEntry;
                                }
                            }
                        } else {
                            // If category is a primitive (string/ObjectId), keep as-is
                            newCategory = test.category;
                        }
                    } catch (e) {
                        // If anything goes wrong, fallback to original category value
                        console.warn('Category normalization failed, using original value', e);
                        newCategory = test.category;
                    }

                    // Map testsId array to tenant test ids (try by originalTestId first, then by name)
                    const mappedTestIds = [];
                    const testsNames = Array.isArray(panel.tests) ? panel.tests : [];
                    const testsIdArr = Array.isArray(panel.testsId) ? panel.testsId : [];

                    for (let idx = 0; idx < testsIdArr.length; idx++) {
                        const srcTestId = testsIdArr[idx];
                        let foundTest = null;

                        // Try find by originalTestId
                        try {
                            foundTest = await testSchema.findOne({
                                tenantId: franchiseeId,
                                originalTestId: srcTestId
                            }).session(session).select('_id');
                        } catch (e) {
                            // ignore
                        }

                        // If not found by originalTestId, try by name (fall back to same index in tests array)
                        if (!foundTest) {
                            const maybeName = testsNames[idx] || null;
                            if (maybeName) {
                                foundTest = await testSchema.findOne({
                                    tenantId: franchiseeId,
                                    Name: maybeName
                                }).session(session).select('_id');
                            }
                        }

                        if (foundTest) mappedTestIds.push(foundTest._id);
                        // else skip that test mapping; panel will have fewer testsId entries
                    }
                    if (panel.createdByRole === 'superAdmin') {
                        copiedPanels.push({
                            ...rest,
                            _id: new mongoose.Types.ObjectId(),
                            createdBy,
                            category: newCategory,
                            tenantId: franchiseeId,
                            isBasePanel: false,
                            purchasedFromBasePanel: true,
                            originalPanelId: panel._id,
                            assignedPrices: {}, // reset assignedPrices
                            // attach mapped test ids if any
                            testsId: mappedTestIds,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                    }
                    else if (panel.createdByRole === 'admin') {
                        copiedPanels.push({
                            ...rest,
                            _id: new mongoose.Types.ObjectId(),
                            createdBy,
                            category: newCategory,
                            tenantId: franchiseeId,
                            isBasePanel: true,
                            purchasedFromBasePanel: false,
                            purchasedBy: [],
                            originalPanelId: panel._id,
                            assignedPrices: [], // reset assignedPrices
                            // attach mapped test ids if any
                            testsId: mappedTestIds,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                    }
                }


                if (copiedPanels.length > 0) {
                    await addPannel.insertMany(copiedPanels, { session });
                    assignedCounts.panels = copiedPanels.length;

                    await Promise.all(
                        newPanels.map(p =>
                            addPannel.findByIdAndUpdate(p._id, {
                                $push: {
                                    purchasedBy: {
                                        tenantId: franchiseeId,
                                        purchasePrice: 2,
                                        purchaseDate: new Date()
                                    }
                                }
                            }, { session })
                        )
                    );
                }
            }
        }

        // === STEP 3: PACKAGES (IMPROVED DUPLICATE DETECTION & ID MAPPING) ===
        if (packageIds && packageIds.length > 0) {
            const [assignedByOriginalId, assignedByName] = await Promise.all([
                Package.find({
                    tenantId: franchiseeId,
                    originalPackageId: { $in: packageIds }
                }).session(session).distinct('originalPackageId'),

                Package.find({
                    tenantId: franchiseeId
                }).session(session).distinct('packageName')
            ]);

            const allCandidatePackages = await Package.find({
                _id: { $in: packageIds },
            }).session(session);

            const candidatePackages = allCandidatePackages.filter(p => {
                if (p.createdByRole === 'admin' || p.createdByRole === 'superAdmin' || p.isBasePackage === true) {
                    return true; // सबको allow
                }
                else {
                    return p.isBasePackage === false
                }
            })

            const assignedPackageOriginalSet = new Set(assignedByOriginalId.map(id => String(id)));
            const assignedPackageNameSet = new Set(assignedByName.map(n => String(n)));

            const newPackages = candidatePackages.filter(pkg =>
                !assignedPackageOriginalSet.has(String(pkg._id)) &&
                !assignedPackageNameSet.has(String(pkg.packageName))
            );

            if (newPackages.length > 0) {

                const copiedPackages = [];

                for (const pkg of newPackages) {
                    const { _id, ...rest } = pkg.toObject();

                    // Map testIds to tenant test ids
                    const mappedTestIds = [];
                    const srcTestIds = Array.isArray(pkg.testIds) ? pkg.testIds : [];
                    const srcTestNames = Array.isArray(pkg.testname) ? pkg.testname : [];

                    for (let i = 0; i < srcTestIds.length; i++) {
                        const srcId = srcTestIds[i];
                        let foundTest = null;
                        try {
                            foundTest = await testSchema.findOne({
                                tenantId: franchiseeId,
                                originalTestId: srcId
                            }).session(session).select('_id');
                        } catch (e) { }
                        if (!foundTest) {
                            const maybeName = srcTestNames[i] || null;
                            if (maybeName) {
                                foundTest = await testSchema.findOne({
                                    tenantId: franchiseeId,
                                    Name: maybeName
                                }).session(session).select('_id');
                            }
                        }
                        if (foundTest) mappedTestIds.push(foundTest._id);
                    }

                    // Map pannelIds to tenant panel ids
                    const mappedPanelIds = [];
                    const srcPanelIds = Array.isArray(pkg.pannelIds) ? pkg.pannelIds : [];
                    const srcPanelNames = Array.isArray(pkg.pannelname) ? pkg.pannelname : [];

                    for (let i = 0; i < srcPanelIds.length; i++) {
                        const srcId = srcPanelIds[i];
                        let foundPanel = null;
                        try {
                            foundPanel = await addPannel.findOne({
                                tenantId: franchiseeId,
                                originalPanelId: srcId
                            }).session(session).select('_id');
                        } catch (e) { }
                        if (!foundPanel) {
                            const maybeName = srcPanelNames[i] || null;
                            if (maybeName) {
                                foundPanel = await addPannel.findOne({
                                    tenantId: franchiseeId,
                                    name: maybeName
                                }).session(session).select('_id');
                            }
                        }
                        if (foundPanel) mappedPanelIds.push(foundPanel._id);
                    }
                    if (pkg.createdByRole === 'superAdmin') {
                        copiedPackages.push({
                            ...rest,
                            _id: new mongoose.Types.ObjectId(),
                            createdBy,
                            tenantId: franchiseeId,
                            isBasePackage: false,
                            purchasedFromBasePackage: true,
                            assignedPrices: [], // reset assignedPrices
                            originalPackageId: pkg._id,
                            testIds: mappedTestIds,
                            pannelIds: mappedPanelIds,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                    } else if (pkg.createdByRole === 'admin') {
                        copiedPackages.push({
                            ...rest,
                            _id: new mongoose.Types.ObjectId(),
                            createdBy,
                            tenantId: franchiseeId,
                            isBasePackage: true,
                            purchasedFromBasePackage: false,
                            assignedPrices: [], // reset assignedPrices
                            purchasedBy: [],
                            originalPackageId: pkg._id,
                            testIds: mappedTestIds,
                            pannelIds: mappedPanelIds,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                    }
                }


                if (copiedPackages.length > 0) {
                    await Package.insertMany(copiedPackages, { session });
                    assignedCounts.packages = copiedPackages.length;

                    await Promise.all(
                        newPackages.map(p =>
                            Package.findByIdAndUpdate(p._id, {
                                $push: {
                                    purchasedBy: {
                                        tenantId: franchiseeId,
                                        purchasePrice: 3,
                                        purchaseDate: new Date()
                                    }
                                }
                            }, { session })
                        )
                    );
                }
            }
        }

        await session.commitTransaction();
        session.endSession();

        const totalAssigned = Object.values(assignedCounts).reduce((sum, count) => sum + count, 0);

        res.status(200).json({
            success: true,
            message: `Successfully assigned ${totalAssigned} models without duplicates.`,
            assignedCounts: assignedCounts,
            details: {
                skippedDuplicates: {
                    tests: (testIds?.length || 0) - assignedCounts.tests,
                    panels: (panelIds?.length || 0) - assignedCounts.panels,
                    packages: (packageIds?.length || 0) - assignedCounts.packages,
                    categories: (categoryIds?.length || 0) - assignedCounts.categories,
                    units: (unitIds?.length || 0) - assignedCounts.units,
                    sampleTypes: (sampleTypeIds?.length || 0) - assignedCounts.sampleTypes
                }
            }
        });

    } catch (err) {
        if (session) {
            try {
                await session.abortTransaction();
            } catch (e) {
                // ignore abort errors
            }
            try {
                session.endSession();
            } catch (e) { }
        }
        console.error("Assignment Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to assign models",
            error: err.message
        });
    }
});

const getAllModels = async (req, res) => {
        let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }
    try {
        const tests = await testSchema.find({ createdBy: userId }).select("_id");
        const panels = await addPannel.find({ createdBy: userId }).select("_id");
        const packages = await Package.find({ createdBy: userId }).select("_id");
        const testIds = tests.map(t => t._id);
        const panelIds = panels.map(p => p._id);
        const packageIds = packages.map(pk => pk._id);

        res.status(200).json({
            success: true,
            testIds,
            panelIds,
            packageIds
        });

    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ success: false, message: "Could not fetch models" });
    }
};


// Add this route to your backend
const adminAssign = asyncHandler(async (req, res) => {
    try {
        const { adminId } = req.body;

        // Fetch assigned tests, panels, packages for this admin
        const assignedTests = await testSchema.find({ tenantId: adminId });
        const assignedPanels = await addPannel.find({ tenantId: adminId });
        const assignedPackages = await Package.find({ tenantId: adminId });

        res.json({
            success: true,
            data: {
                tests: assignedTests,
                panels: assignedPanels,
                packages: assignedPackages
            }
        });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

const getAllAddOns = asyncHandler(async (req, res) => {
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }
    try {
        const units = await unitdb.find({ createdBy: userId }).select("_id");
        const sampleTypes = await sampleSchema.find({ createdBy: userId }).select("_id");
        const categories = await categorydb.find({ createdBy: userId }).select("_id");
        const unitIds = units.map(u => u._id);
        const sampleTypeIds = sampleTypes.map(s => s._id);
        const categoryIds = categories.map(c => c._id);
        res.status(200).json({
            success: true,
            unitIds,
            sampleTypeIds,
            categoryIds
        });
    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ success: false, message: "Could not fetch add-ons" });
    }
});

export {
    addingTest,
    editTest,
    allTest,
    testCate,
    editTestCate,
    editdefaultresult,
    getAllTestCate,
    getOneTestCate,
    updateTestCate,
    findTestcontroller,
    updateTestcontroller,
    updateTestOrder,
    updateTestOrdersuper,
    updateTestInterpretation,
    getOneTest,
    addsample,
    fetchsample,
    getUnits,
    addUnit,
    tenantTest,
    getAllModels,
    assignModelsToFranchisee,
    addingTesttenant,
    updateTestCateadmin,
    getAllTestCateadmin,
    fetchsampleadmin,
    addUnitadmin,
    addsampleadmin,
    editTesttenant,
    adminAssign,
    getAllAddOns,
}
