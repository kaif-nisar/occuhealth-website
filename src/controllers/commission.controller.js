import { asyncHandler } from "../utils/asyncHandler.js";
import { testSchema } from "../models/newTest.model.js";
import { addPannel } from "../models/AddPannel.model.js";
import { Package } from "../models/addPackage.model.js";
import { Ledger } from "../models/ledger.model.js";
import { User } from "../models/user.model.js";
import { Types } from "mongoose";
// Bulk price assignment API
const assignTestPrice = asyncHandler(async (req, res) => {
  try {
    const { items } = req.body;
    let successCount = 0;
    let failedItems = [];
    let testSuccess = 0
    let panelSuccess = 0
    let packageSuccess = 0;
    // let newId;
    let test = [];
    let panel = [];
    let packages = [];
    for (let item of items) {
      const {
        type,
        testId,
        price,
        commissionRate,
        finalPrice,
        franchiseeId,
        assignedBy,
      } = item;
      // ID validation
      if (!testId || !Types.ObjectId.isValid(testId)) {
        throw new Error(`Invalid testId format: ${testId}`);
      }
      // Check price
      if (price === undefined || price === null || price === "") {
        throw new Error(`Price is missing or invalid for item: ${testId}`);
      }

      // Check other required fields
      if (!franchiseeId || !assignedBy) {
        throw new Error(`Missing required fields for item: ${testId}`);
      }

      if (type == "test") {
        test.push({
          testId,
          price,
          commissionRate,
          finalPrice,
          franchiseeId,
          assignedBy
        })
      } else if (type == "panel") {
        panel.push({
          testId,
          price,
          commissionRate,
          finalPrice,
          franchiseeId,
          assignedBy
        });
      } else if (type == 'package') {
        packages.push({
          testId,
          price,
          commissionRate,
          finalPrice,
          franchiseeId,
          assignedBy
        });
      }
    }
    function bulkWriteUpdate(test) {
      return test.map((item => ({
        updateOne: {
          filter: { _id: item.testId, "assignedPrices.userId": item.franchiseeId },
          update: {
            $set: {
              "assignedPrices.$.price": Number(item.price),
              "assignedPrices.$.commission": Number(item.commissionRate),
            }
          }
        }
      })
      ))
    }
    function bulkWritePush(test) {
      return test.map(t => ({
        updateOne: {
          filter: { _id: t.testId, "assignedPrices.userId": { $ne: t.franchiseeId } },
          update: {
            $push: {
              assignedPrices: {
                userId: new Types.ObjectId(t.franchiseeId),
                assignedBy: new Types.ObjectId(t.assignedBy),
                price: Number(t.price),
                commission: Number(t.commissionRate),
                assignedAt: new Date()
              }

            }
          }
        }
      }))
    }
    
    const ft = performance.now()
    // Process test assignments in bulk using bulkWrite
    const bulkTestUpdate = bulkWriteUpdate(test)
    const bulkTestCreate = bulkWritePush(test)
    const bulkPanelUpdate = bulkWriteUpdate(panel)
    const bulkPanelCreate =bulkWritePush(panel)
    const bulkPackageUpdate = bulkWriteUpdate(packages)
    const bulkPackageCreate = bulkWritePush(packages)

    const startTime = performance.now();

    const [testUpdateReq, testPushReq, panelUpdateReq, panelPushReq, packageUpdateReq, PackagePushReq] = await Promise.all([
      testSchema.bulkWrite(bulkTestUpdate, { ordered: false }),
      testSchema.bulkWrite(bulkTestCreate, { ordered: false }),
      addPannel.bulkWrite(bulkPanelUpdate, { ordered: false }),
      addPannel.bulkWrite(bulkPanelCreate, { ordered: false }),
      Package.bulkWrite(bulkPackageUpdate, { ordered: false }),
      Package.bulkWrite(bulkPackageCreate, { ordered: false })
    ])
    const endTime = performance.now();

    console.log(`total updating time${(endTime - startTime).toFixed(2)}`)
    testSuccess = testPushReq.modifiedCount + testUpdateReq.modifiedCount
    panelSuccess = panelUpdateReq.modifiedCount + panelPushReq.modifiedCount
    packageSuccess = packageUpdateReq.modifiedCount + PackagePushReq.modifiedCount
    successCount = testSuccess + panelSuccess + packageSuccess

    res.status(200).json({
      message: `${successCount} prices assigned successfully (${testSuccess} tests, ${panelSuccess} panels, ${packageSuccess} packages). ${failedItems.length} items failed.`,
      successCount,
      testSuccess,
      panelSuccess,
      packageSuccess,
      failedCount: failedItems.length,
      failedItems: failedItems.slice(0, 10), // Just show first 10 failed items
      //totalUpdateTest
    });
  } catch (error) {
    console.error("Error during bulk assignment:", error);
    res
      .status(500)
      .json({ message: "Error during bulk assignment", error: error.message });
  }
});

// Helper function to update prices without full document validation
async function updatePricesWithoutValidation(model, id, priceData) {
  try {
    // First get existing assignedPrices
    const document = await model.findById(id);
    if (!document) return false;

    // Create or update the assignedPrices array
    let assignedPrices = document.assignedPrices || [];

    const existingIndex = assignedPrices.findIndex(
      (entry) =>
        entry.userId && entry.userId.toString() === priceData.userId.toString()
    );

    if (existingIndex !== -1) {
      // Update existing entry
      assignedPrices[existingIndex] = {
        ...assignedPrices[existingIndex],
        ...priceData,
      };
    } else {
      // Add new entry
      assignedPrices.push(priceData);
    }

    // Update using findOneAndUpdate to bypass full validation
    const result = await model.findOneAndUpdate(
      { _id: id },
      { $set: { assignedPrices: assignedPrices } },
      { new: true }
    );

    if (!result) {
      console.error(`Failed to update document (${id}) in ${model.modelName}`);
    }



    return !!result;
  } catch (error) {
    console.error(`Error updating prices:`, error);
    return false;
  }
}

import mongoose from "mongoose";

const assignSingleTestPrice = asyncHandler(async (req, res) => {
  try {
    let {
      testId,
      price,
      commissionRate,
      finalPrice,
      franchiseeId,
      assignedBy,
    } = req.body;

    // ===============================
    // 1️⃣ Validate & Convert IDs
    // ===============================

    let testObjectId;
    let franchiseeObjectId;

    try {
      testObjectId = new mongoose.Types.ObjectId(testId);
      franchiseeObjectId = new mongoose.Types.ObjectId(franchiseeId);
    } catch (err) {
      return res.status(400).json({ message: "Invalid testId or franchiseeId" });
    }

    if (!assignedBy) {
      return res.status(400).json({ message: "assignedBy is required" });
    }

    if (price === undefined || price === null || price === "") {
      return res.status(400).json({ message: "Price is required" });
    }

    // ===============================
    // 2️⃣ Build Price Object
    // ===============================

    const basePrice = finalPrice !== undefined && finalPrice !== null
      ? Number(finalPrice)
      : Number(price);

    const priceData = {
      userId: franchiseeObjectId,
      price: Number(price),
      basePrice: basePrice,
      commission: Number(commissionRate || 0),
      assignedBy: assignedBy,
      assignedAt: new Date(),
    };

    // ===============================
    // 3️⃣ Update Function
    // ===============================

    const updateWithoutValidation = async (model, id, data) => {
      try {
        const doc = await model.findById(id);
        if (!doc) return false;

        let assignedPrices = doc.assignedPrices || [];

        // Remove old price of this franchisee
        assignedPrices = assignedPrices.filter(
          (p) => p.userId.toString() !== data.userId.toString()
        );

        // Push new price
        assignedPrices.push(data);

        await model.updateOne(
          { _id: id },
          {
            $set: {
              assignedPrices: assignedPrices,
              final_price: data.basePrice,
            },
          }
        );

        return true;
      } catch (err) {
        console.error(`Update error in ${model.modelName}`, err);
        return false;
      }
    };

    // ===============================
    // 4️⃣ Try in Test / Panel / Package
    // ===============================

    let updated = false;
    let docType = "";

    if (await updateWithoutValidation(testSchema, testObjectId, priceData)) {
      updated = true;
      docType = "Test";
    } else if (await updateWithoutValidation(addPannel, testObjectId, priceData)) {
      updated = true;
      docType = "Panel";
    } else if (await updateWithoutValidation(Package, testObjectId, priceData)) {
      updated = true;
      docType = "Package";
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "No matching test, panel, or package found",
      });
    }

    // ===============================
    // 5️⃣ Staff Activity Log
    // ===============================

    if (req.user.role === "staff") {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          activities: {
            activityType: "other",
            details: {
              staffId: req.user._id,
              staffName: req.user.fullName,
              action: "Staff assigned a single price",
              franchiseeId: franchiseeObjectId,
              testId: testObjectId,
            },
            reference: {
              model: "singlePriceAssignment",
              id: franchiseeObjectId,
            },
            timestamp: new Date(),
          },
        },
      });
    }

    // ===============================
    // 6️⃣ Success Response
    // ===============================

    res.status(200).json({
      success: true,
      message: `Price assigned successfully for ${docType}`,
      data: priceData,
    });

  } catch (error) {
    console.error("Single price assignment error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});


// const getAssignedTests = async (req, res) => {
//   try {
//     const { userId, oldId } = req.query; // Franchisee ID passed in the query parameters

//     if (!userId) {
//       return res.status(400).json({ message: 'User ID is required' });
//     }

//     let tests;

//     if (oldId) {
//       // Fetch tests assigned to the specific franchisee (oldId)
//       tests = await testSchema.find({
//         'assignedPrices.userId': oldId,
//       }).select('Name Price final_price assignedPrices sampleType');
//     } else {
//       // Fetch tests assigned to the current user (userId)
//       tests = await testSchema.find({
//         'assignedPrices.userId': userId,
//       }).select('Name Price final_price assignedPrices sampleType');
//     }

//     // Filter assignedPrices for the specific franchisee and include calculated prices
//     const result = tests.map(test => {
//       const assignedToUser = test.assignedPrices.find(ap => ap.userId.toString() === (oldId || userId));
//       const assignedByUser = test.assignedPrices.find(ap => ap.assignedBy.toString() === userId);

//       return {
//         testId: test._id,
//         testName: test.Name,
//         basePrice: test.Price,
//         mrpPrice: test.final_price,
//         sampleType: test.sampleType,
//         myPrice: assignedToUser?.price || 0,
//         assignedPriceToUser: assignedToUser ? assignedToUser.price : null,
//         commissionToUser: assignedToUser ? assignedToUser.commission : null,
//         assignedPriceByUser: assignedByUser ? assignedByUser.price : null,
//         commissionByUser: assignedByUser ? assignedByUser.commission : null,
//       };
//     });

//     res.status(200).json(result);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Internal Server Error' });
//   }
// };

const getAssignedTests = async (req, res) => {
  try {
    const { userId, oldId } = req.query; // Franchisee ID passed in the query parameters
    const role = req.user.role;
    const parentRole = req.user.parentRole
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (role === "admin" || (role === "staff" && parentRole === "admin")) {
      // If the role is admin, fetch all tests
      console.log("Admin role detected. Fetching all tests with appropriate prices.");

      // Get all tests
      const allTests = await testSchema.find({ tenantId: req.user.tenantId })
      // .select("Name Price final_price assignedPrices sampleType Short");

      // Map all tests with either assigned price to the franchisee or default price
      const result = allTests.map((test) => {
        // Check if the test has an assigned price for the specified franchisee (oldId)
        const assignedToFranchisee = test.assignedPrices?.find(
          (ap) => ap.userId.toString() === oldId
        );

        return {
          testId: test._id,
          testName: test.Name,
          basePrice: test.Price || 0,
          // If there's an assigned price for the franchisee, use it; otherwise use default
          franchiseePrice: assignedToFranchisee ? assignedToFranchisee.price : test.Price || 0,
          myPrice: assignedToFranchisee ? assignedToFranchisee.price : test.Price || 0,
          mrpPrice: test.final_price || 0,
          sampleType: test.sampleType || "N/A",
          assignedPriceToUser: assignedToFranchisee ? assignedToFranchisee.price : null,
          commissionToUser: assignedToFranchisee ? assignedToFranchisee.commission : null,
          // Flag to indicate if this test has been assigned to the franchisee
          isAssigned: !!assignedToFranchisee,
          Short_name: test.Short_name,
          createdAt: test.createdAt
        };
      });

      return res.status(200).json(result);
    } else {
      // For non-admin users, fetch only tests that have been assigned to them or by them
      const tests = await testSchema
        .find({
          $or: [
            {
              // Prices assigned to the selected franchisee (oldId) by the current user (userId)
              "assignedPrices.userId": oldId,
              "assignedPrices.assignedBy": userId,
            },
            {
              // Prices assigned to the current user (userId)
              "assignedPrices.userId": userId,
            },
          ],
        })
      // .select("Name Price final_price assignedPrices sampleType");

      // Map the tests with appropriate prices
      const result = tests.map((test) => {
        // Find assignment to the franchisee by the current user
        const assignedToFranchisee = test.assignedPrices?.find(
          (ap) =>
            ap.userId.toString() === oldId && ap.assignedBy.toString() === userId
        );

        // Find assignment to the current user (regardless of who assigned it)
        const assignedToUser = test.assignedPrices?.find(
          (ap) => ap.userId.toString() === userId
        );

        return {
          testId: test._id,
          testName: test.Name,
          basePrice: test.Price || 0,
          mrpPrice: test.final_price || 0,
          sampleType: test.sampleType || "N/A",

          // Price assigned to the selected franchisee
          franchiseePrice: assignedToFranchisee ? assignedToFranchisee.price : test.Price || 0,
          assignedPriceToFranchisee: assignedToFranchisee ? assignedToFranchisee.price : null,
          commissionToFranchisee: assignedToFranchisee ? assignedToFranchisee.commission : null,

          // Price assigned to the current user
          myPrice: assignedToUser ? assignedToUser.price : test.Price || 0,
          assignedPriceToUser: assignedToUser ? assignedToUser.price : null,
          commissionToUser: assignedToUser ? assignedToUser.commission : null,

          // Flag to indicate if this test has been assigned to the franchisee
          isAssigned: !!assignedToFranchisee,
          Short_name: test.Short_name,
          createdAt: test.createdAt

        };
      });

      return res.status(200).json(result);
    }
  } catch (error) {
    console.error("Error fetching assigned tests:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getAssignedPanels = async (req, res) => {
  try {
    const { userId, oldId } = req.query; // Franchisee ID passed in the query parameters
    const role = req.user.role;
    const parentRole = req.user.parentRole
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    let panels;

    if (role === "admin" || (role === "staff" && parentRole === "admin")) {
      // If the role is admin, fetch all tests
      console.log("Admin role detected. Fetching all tests with appropriate prices.");

      // Get all tests
      const panels = await addPannel
        .find({ tenantId: req.user.tenantId })
        .select("name price final_price assignedPrices sample_types createdAt");
      // Map all tests with either assigned price to the franchisee or default price
      const result = panels.map((panel) => {
        // Check if the panel has an assigned price for the specified franchisee (oldId)
        const assignedToFranchisee = panel.assignedPrices?.find(
          (ap) => ap?.userId?.toString() === oldId
        );

        return {
          panelId: panel._id,
          panelName: panel.name,
          basePrice: panel.price || 0,
          tests: panel.tests,
          // If there's an assigned price for the franchisee, use it; otherwise use default
          franchiseePrice: assignedToFranchisee ? assignedToFranchisee.price : panel.price || 0,
          myPrice: assignedToFranchisee ? assignedToFranchisee.price : panel.price || 0,
          mrpPrice: panel.final_price || 0,
          sampleType: panel.sample_types || "N/A",
          assignedPriceToUser: assignedToFranchisee ? assignedToFranchisee.price : null,
          commissionToUser: assignedToFranchisee ? assignedToFranchisee.commission : null,
          // Flag to indicate if this test has been assigned to the franchisee
          isAssigned: !!assignedToFranchisee,
          createdAt: panel.createdAt
        };
      });

      return res.status(200).json(result);
    } else {
      // Fetch panels where assignedPrices match either Condition 1 or Condition 2
      panels = await addPannel
        .find({
          $or: [
            {
              // Condition 1: Prices assigned to the selected franchisee (oldId) by the current user (userId)
              "assignedPrices.userId": oldId,
              "assignedPrices.assignedBy": userId,
            },
            {
              // Condition 2: Prices assigned to the current user (userId)
              "assignedPrices.userId": userId,
            },
          ],
        })
        .select("name tests price final_price assignedPrices sample_types createdAt");
    }

    // Filter assignedPrices for the specific franchisee and include necessary fields
    const result = panels.map((panel) => {
      // Find the price assigned to the selected franchisee (oldId) by the current user (userId)
      const assignedToFranchisee = panel.assignedPrices.find(
        (ap) =>
          ap?.userId?.toString() === oldId &&
          ap?.assignedBy?.toString() === userId
      );

      // Find the price assigned to the current user (userId)
      const assignedToUser = panel.assignedPrices.find(
        (ap) => ap?.userId?.toString() === userId
      );

      return {
        panelId: panel._id, // From pannelSchema
        panelName: panel.name, // From pannelSchema
        tests: panel.tests, // From pannelSchema
        basePrice: panel.price, // From pannelSchema
        mrpPrice: panel.final_price,
        sampleType: panel.sample_types,

        // Price assigned to the selected franchisee
        franchiseePrice: assignedToFranchisee?.price || 0,
        assignedPriceToFranchisee: assignedToFranchisee
          ? assignedToFranchisee.price
          : null,
        commissionToFranchisee: assignedToFranchisee
          ? assignedToFranchisee.commission
          : null,

        // Price assigned to the current user
        myPrice: assignedToUser?.price || 0,
        assignedPriceToUser: assignedToUser ? assignedToUser.price : null,
        commissionToUser: assignedToUser ? assignedToUser.commission : null,
        createdAt: panel.createdAt

      };
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching assigned panels:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const getAssignedPackages = async (req, res) => {
  try {
    const { userId, oldId } = req.query; // Franchisee ID passed in the query parameters
    const role = req.user.role;
    const parentRole = req.user.parentRole
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    let packages;
    if (role === "admin" || (role === "staff" && parentRole === "admin")) {
      // If the role is admin, fetch all tests
      console.log("Admin role detected. Fetching all tests with appropriate prices.");
      // Get all tests
      const packages = await Package
        .find({ tenantId: req.user.tenantId })
        .select("packageName packageFee final_price assignedPrices testSample pannelSample createdAt");
      // Map all tests with either assigned price to the franchisee or default price
      const result = packages.map((packageList) => {
        // Check if the panel has an assigned price for the specified franchisee (oldId)
        const assignedToFranchisee = packageList.assignedPrices?.find(
          (ap) => ap.userId.toString() === oldId
        );
        return {
          packageId: packageList._id, // From packageSchema
          packageName: packageList.packageName, // From packageSchema
          testNames: packageList.testname, // From packageSchema
          panelNames: packageList.pannelname, // From packageSchema
          basePrice: packageList.packageFee, // From packageSchema
          mrpPrice: packageList.final_price,
          sampleType: packageList.testSample,
          sample_types: packageList.pannelSample,
          // If there's an assigned price for the franchisee, use it; otherwise use default
          franchiseePrice: assignedToFranchisee ? assignedToFranchisee.price : packageList.packageFee || 0,
          myPrice: assignedToFranchisee ? assignedToFranchisee.price : packageList.packageFee || 0,
          mrpPrice: packageList.final_price || 0,
          assignedPriceToUser: assignedToFranchisee ? assignedToFranchisee.price : null,
          commissionToUser: assignedToFranchisee ? assignedToFranchisee.commission : null,
          // Flag to indicate if this test has been assigned to the franchisee
          isAssigned: !!assignedToFranchisee,
          createdAt: packageList.createdAt
        };
      });

      return res.status(200).json(result);
    } else {
      // Fetch packages where assignedPrices match either Condition 1 or Condition 2
      packages = await Package.find({
        $or: [

          {
            // Condition 2: Prices assigned to the current user (userId)
            "assignedPrices.userId": userId,
          },
        ],
      }).select(
        "packageName testname pannelname packageFee final_price assignedPrices testSample pannelSample createdAt"
      );
    }
    // Filter assignedPrices for the specific franchisee and include necessary fields
    const result = packages.map((packageList) => {
      // Find the price assigned to the selected franchisee (oldId) by the current user (userId)
      const assignedToFranchisee = packageList.assignedPrices.find(
        (ap) =>
          ap.userId.toString() === oldId &&
          ap.assignedBy.toString() === userId
      );

      // Find the price assigned to the current user (userId)
      const assignedToUser = packageList.assignedPrices.find(
        (ap) => ap.userId.toString() === userId
      );

      return {
        packageId: packageList._id, // From packageSchema
        packageName: packageList.packageName, // From packageSchema
        testNames: packageList.testname, // From packageSchema
        panelNames: packageList.pannelname, // From packageSchema
        basePrice: packageList.packageFee, // From packageSchema
        mrpPrice: packageList.final_price,
        sampleType: packageList.testSample,
        sample_types: packageList.pannelSample,

        // Price assigned to the selected franchisee
        franchiseePrice: assignedToFranchisee?.price || 0,
        assignedPriceToFranchisee: assignedToFranchisee
          ? assignedToFranchisee.price
          : null,
        commissionToFranchisee: assignedToFranchisee
          ? assignedToFranchisee.commission
          : null,

        // Price assigned to the current user
        myPrice: assignedToUser?.price || 0,
        assignedPriceToUser: assignedToUser ? assignedToUser.price : null,
        commissionToUser: assignedToUser ? assignedToUser.commission : null,
        createdAt: packageList.createdAt
      };
    });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching assigned packages:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// API to get ledger entries for a specific user
const listCommission = asyncHandler(async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    // Fetch ledger entries for the given user, filtered by date
    // Validate userId
    if (Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid User ID format" });
    }

    // Build the query
    const query = {
      userId: new Types.ObjectId(userId),
      type: "credit",
    };
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else {
      // If no date is provided, default to the last 7 days
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);

      query.createdAt = {
        $gte: sevenDaysAgo,
        $lte: today,
      };
    }

    // Add condition to fetch entries where `remarks` is missing or null
    query.remarks = { $exists: false }; // Fetch only documents where `remarks` field is not present
    // Fetch ledger entries
    const ledgerEntries = await Ledger.find(query).sort({ createdAt: -1 });
    //  if (!ledgerEntries || ledgerEntries.length === 0) {
    //      return res.status(404).json({ message: "No ledger entries found" });
    //  }
    // Send successful response
    // console.log(ledgerEntries)
    res.status(200).json({ success: true, data: ledgerEntries });
  } catch (error) {
    console.error("Error fetching commission ledger:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch ledger entries" });
  }
});

// API to get ledger total amount for a specific user
const totalCommission = asyncHandler(async (req, res) => {
  const { userId, startDate, endDate } = req.query;

  // Validate userId
  if (Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid User ID format" });
  }

  // Base query
  const baseQuery = {
    userId: new Types.ObjectId(userId),
    type: "credit",
  };
  baseQuery.remarks = { $exists: false };
  // Fetch total commission
  const totalCommission = await Ledger.aggregate([
    { $match: baseQuery },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  // Today's date range
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayQuery = {
    ...baseQuery,
    createdAt: { $gte: todayStart, $lte: todayEnd },
  };

  const todayCommission = await Ledger.aggregate([
    { $match: todayQuery },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  // This month's date range
  const monthStart = new Date(
    todayStart.getFullYear(),
    todayStart.getMonth(),
    1
  );
  const monthEnd = new Date(
    todayStart.getFullYear(),
    todayStart.getMonth() + 1,
    0,
    23,
    59,
    59
  );

  const monthQuery = {
    ...baseQuery,
    createdAt: { $gte: monthStart, $lte: monthEnd },
  };

  const monthCommission = await Ledger.aggregate([
    { $match: monthQuery },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      today: todayCommission[0]?.total || 0,
      month: monthCommission[0]?.total || 0,
      total: totalCommission[0]?.total || 0,
    },
  });
});

const getLedger = asyncHandler(async (req, res) => {
  try {
    const { franchiseeId, startDate, endDate } = req.query;

    // Validate inputs
    if (!franchiseeId || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Parse dates for querying
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include end date till midnight

    // Fetch all ledger entries within the date range for the franchisee
    const ledgerEntries = await Ledger.find({
      franchiseeId,
      transactionDate: { $gte: start, $lte: end },
    }).sort({ transactionDate: 1 });

    // Calculate opening balance
    const openingBalance = await Ledger.aggregate([
      { $match: { franchiseeId, transactionDate: { $lt: start } } },
      {
        $group: {
          _id: null,
          balance: {
            $sum: {
              $subtract: [
                { $ifNull: ["$credit", 0] },
                { $ifNull: ["$debit", 0] },
              ],
            },
          },
        },
      },
    ]);

    const openingBalanceValue =
      openingBalance.length > 0 ? openingBalance[0].balance : 0;

    // Calculate closing balance
    let currentBalance = openingBalanceValue;
    ledgerEntries.forEach((entry) => {
      currentBalance += (entry.credit || 0) - (entry.debit || 0);
    });

    // Return ledger data
    res.json({
      openingBalance: openingBalanceValue,
      closingBalance: currentBalance,
      ledgerEntries,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getLedgerSummary = asyncHandler(async (req, res) => {
  try {
    const { franchiseeId, startDate, endDate } = req.query;

    // Validate inputs
    if (!franchiseeId || !startDate || !endDate) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch all ledger entries for the franchisee within the date range
    const ledgerEntries = await Ledger.find({
      franchiseeId,
      transactionDate: { $gte: start, $lte: end },
    });

    if (!ledgerEntries.length) {
      return res
        .status(404)
        .json({ message: "No transactions found for the given range" });
    }

    // Calculate Opening and Closing Balances
    const openingBalance = ledgerEntries[0].balanceBeforeTransaction || 0;
    const closingBalance =
      ledgerEntries[ledgerEntries.length - 1].balanceAfterTransaction || 0;

    // Summarize amounts
    const summary = {
      openingBalance,
      closingBalance,
      bookingAmount: ledgerEntries
        .filter((e) => e.type === "booking")
        .reduce((sum, e) => sum + e.amount, 0),
      cancellationRefund: ledgerEntries
        .filter((e) => e.type === "refund")
        .reduce((sum, e) => sum + e.amount, 0),
      commissionAmount: ledgerEntries
        .filter((e) => e.type === "commission")
        .reduce((sum, e) => sum + e.amount, 0),
      depositAmount: ledgerEntries
        .filter((e) => e.type === "deposit")
        .reduce((sum, e) => sum + e.amount, 0),
      inventoryDebit: ledgerEntries
        .filter((e) => e.type === "inventoryDebit")
        .reduce((sum, e) => sum + e.amount, 0),
      debitedAdjusted: ledgerEntries
        .filter((e) => e.type === "adjustment")
        .reduce((sum, e) => sum + e.amount, 0),
    };

    res.json(summary);
  } catch (error) {
    console.error("Error fetching ledger summary:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
async function getAccountSummary(userId, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Fetch ledger transactions within the range
  const transactions = await Ledger.find({
    userId,
    createdAt: { $gte: start, $lte: end },
  }).sort({ createdAt: 1 });

  if (!transactions.length) {
    throw new Error("No transactions found in the given date range");
  }

  // Calculate opening balance from the first transaction in the range
  const openingBalance =
    transactions[0].balanceAfterTransaction - transactions[0].amount;

  // Calculate closing balance from the last transaction in the range
  const closingBalance =
    transactions[transactions.length - 1].balanceAfterTransaction;

  // Extract various amounts from transactions
  const summary = {
    openingBalance,
    closingBalance,
    // Commission: "credit" transactions with `description` as test IDs (e.g., "HL...").
    commission: transactions
      .filter((txn) => txn.type === "credit" && txn.description.match(/^HL\d+/))
      .reduce((sum, txn) => sum + txn.amount, 0),
    bookingAmount: transactions
      .filter(
        (txn) => txn.description.startsWith("Booking") && txn.type === "debit"
      )
      .reduce((sum, txn) => sum + txn.amount, 0),
    // Cancellation Refunds: "credit" transactions for cancellations/refunds.
    cancellationRefund: transactions
      .filter(
        (txn) =>
          txn.description.includes("Refund") ||
          txn.description.includes("Cancel")
      )
      .reduce((sum, txn) => sum + txn.amount, 0),

    // Deposits: "credit" transactions with `description` as "Received from ...".
    depositAmount: transactions
      .filter(
        (txn) => txn.type === "credit" && txn.description.startsWith("Received")
      )
      .reduce((sum, txn) => sum + txn.amount, 0),

    // Debit Adjusted Amount: "debit" transactions for online payments sent.
    debitedAdjustedAmount: transactions
      .filter(
        (txn) =>
          txn.type === "debit" && txn.description.startsWith("Transferred")
      )
      .reduce((sum, txn) => sum + txn.amount, 0),
  };

  return summary;
}

const accountSummary = asyncHandler(async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query; // Extract query parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Call the function to calculate summary
    const summary = await getAccountSummary(userId, startDate, endDate);

    // Send the result as response
    res.status(200).json(summary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const getLedgerEntries = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch transactions within date range
    const transactions = await Ledger.find({
      userId: userId,
      createdAt: { $gte: start, $lte: end },
    }).sort({ createdAt: 1 }).populate('caseId');

    if (!transactions.length) {
      return res
        .status(404)
        .json({ message: "No transactions found in the given range." });
    }

    // Prepare response with additional details
    const response = transactions.map((txn, index) => ({
      index: index + 1,
      franchiseeId: txn.userId,
      dateOfTransaction: txn.createdAt,
      debit: txn.type === "debit" ? txn.amount : null,
      credit: txn.type === "credit" ? txn.amount : null,
      remarks: txn.description || txn.remarks,
      reference: txn.transactionId || null,
      patient: txn.patientName || null,
      testName: txn.testDetails.map((obj) => {
        return obj.testName;
      }) || null,
      barcodeId: txn.sampleBarcodeId || null,
      // testName: txn.testDetails?.[0]?.testName || null,
      // barcodeId: txn.sampleBarcodeId?.[0] || null,
      closingBalance: txn.balanceAfterTransaction || null,
      discountamount: txn.discountamount || 0,
      discountunit: txn.discountunit || 0,
      booking: txn.caseId
    }));
    // Calculate opening balance
    const openingBalance =
      transactions[0].balanceAfterTransaction -
      (transactions[0].type === "debit"
        ? transactions[0].amount
        : -transactions[0].amount);
    console.log(openingBalance);
    res.json({ openingBalance, transactions: response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Fetch business analytics for the current user and their sub-franchisees
const getBusinessAnalytics = asyncHandler(async (req, res) => {
  const { userId } = req.query; // Current user's ID
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch full year business data for the current user
    const userBusiness = await Ledger.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          type: "credit",
          createdAt: {
            $gte: new Date(currentYear, 0, 1), // Jan 1
            $lte: new Date(currentYear, 11, 31, 23, 59, 59), // Dec 31
          },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          totalBusiness: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]);
    console.log(userBusiness);
    // Fetch sub-franchisees
    const downlineFranchisees = await User.find({ createdBy: userId }).select(
      "_id username"
    );

    // Fetch current month's business data for sub-franchisees
    const downlineBusiness = await Ledger.aggregate([
      {
        $match: {
          userId: { $in: downlineFranchisees.map((f) => f._id) },
          type: "credit",
          createdAt: {
            $gte: new Date(currentYear, currentMonth - 1, 1),
            $lte: new Date(currentYear, currentMonth, 0, 23, 59, 59),
          },
        },
      },
      {
        $group: {
          _id: { userId: "$userId" },
          totalBusiness: { $sum: "$amount" },
        },
      },
    ]);

    // Format sub-franchisee data
    const downlineData = downlineFranchisees.map((franchisee) => {
      const thisMonthBusiness = downlineBusiness.find(
        (b) => b._id.userId.toString() === franchisee._id.toString()
      );
      return {
        franchiseeId: franchisee._id,
        franchiseeName: franchisee.username,
        thisMonthBusiness: thisMonthBusiness
          ? thisMonthBusiness.totalBusiness
          : 0,
      };
    });

    res.status(200).json({
      userBusiness,
      downlineData,
    });
  } catch (error) {
    console.error("Error fetching business analytics:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export {
  assignTestPrice,
  getAssignedTests,
  getAssignedPanels,
  getAssignedPackages,
  listCommission,
  getLedger,
  getLedgerSummary,
  totalCommission,
  accountSummary,
  getLedgerEntries,
  assignSingleTestPrice,
  getBusinessAnalytics,
};
