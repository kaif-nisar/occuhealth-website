import { addPannel } from "../models/AddPannel.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { pannelCounter } from "../models/counterPannel.model.js";
import { SuperAdmin } from "../models/superAdmin.model.js";
import { User } from "../models/user.model.js";
import mongoose from "mongoose";

// superAdmin add Panel 
const addpannelcontroller = asyncHandler(async (req, res) => {
  const {
    pannelname,
    category,
    rawPrice,
    inputarray,
    interpretion,
    sample_types,
    hideInterpretation,
    hideMethodInstrument,
    final_price,
    testsId
  } = req.body;

  let userId
  if (req.user.role === 'staff') {
    userId = req.user.parentUser
  } else {
    userId = req.user._id
  }

  // Check for missing fields
  if (!pannelname || !category || !final_price) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const allreadyExistedpannel = await addPannel.findOne({
    name: pannelname,
    createdby: userId
  });

  if (allreadyExistedpannel) {
    return res
      .status(400)
      .json({ message: "Pannel already exists in database" });
  }

  const price = Number(rawPrice); // Convert the price to a number

  const lastPanel = await addPannel
    .findOne({ createdBy: userId }) // optionally filter by tenant
    .sort({ order: -1 })             // highest order first
    .select('order');                // only fetch order field

  const nextOrder = lastPanel ? lastPanel.order + 1 : 1;

  // Create the pannel in the database
  const createPannel = {
    order: nextOrder,
    name: pannelname,
    category,
    price,
    tests: inputarray,
    interpretation: interpretion,
    sample_types,
    hideInterpretation,
    hideMethodInstrument,
    final_price,
    originalPanelId: null,
    isBasePanel: true, // Set to true if this is a base test
    createdByRole: 'superAdmin', // Add the role of the user creating the test
    purchasedFromBasePanel: false,
    tenantId: null, // Set tenantId to null for SuperAdmin tests
    createdBy: userId,
    testsId,
  };

  const panelCreated = await addPannel.create(createPannel);

  // Check if the pannel was successfully created
  if (!panelCreated) {
    return res.status(400).json({ message: "Failed to create pannel" });
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
            action: "Staff created a new Pannel",
            panelName: pannelname,
            panelId: panelCreated._id
          },
          reference: {
            model: "panel",
            id: panelCreated._id
          },
          timestamp: new Date()
        }
      }
    });
  }

  // Send a success response
  return res.status(200).json(
    { message: "Pannel created successfully", panelCreated, status: "success" }
  );
});

// admin add Panel
const addpannelcontrollerforadmin = asyncHandler(async (req, res) => {
  const {
    pannelname,
    category,
    price: rawPrice,
    inputarray,
    interpretion,
    sample_types,
    hideInterpretation,
    hideMethodInstrument,
    final_price,
    testsId
  } = req.body;


  let userId;
  if (req.user.role === 'staff') {
    userId = req.user.parentUser
  } else {
    userId = req.user._id
  }
  const tenantId = req.user.tenantId._id;
  // Check for missing fields
  if (!pannelname || !category || !final_price) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const allreadyExistedpannel = await addPannel.findOne({
    name: pannelname,
    createdby: userId,
    tenantId: tenantId
  });

  if (allreadyExistedpannel) {
    return res
      .status(400)
      .json({ message: "Pannel already exists in database" });
  }

  const price = Number(rawPrice); // Convert the price to a number

  const lastPanel = await addPannel
    .findOne({ tenantId })            // optionally filter by tenant
    .sort({ order: -1 })             // highest order first
    .select('order');                // only fetch order field

  const nextOrder = lastPanel ? lastPanel.order + 1 : 1;

  // Create the pannel in the database
  const createPannel = {
    order: nextOrder,
    name: pannelname,
    category,
    price,
    tests: inputarray,
    interpretation: interpretion,
    sample_types,
    hideInterpretation,
    hideMethodInstrument,
    final_price,
    createdBy: userId, // add the super admin id to the test
    originalPanelId: null,
    isBasePanel: true, // Set to true if this is a base test
    createdByRole: 'admin', // Add the role of the user creating the test
    purchasedFromBasePanel: false,
    tenantId: tenantId, // Set tenantId to null for SuperAdmin tests
    createdBy: req.user._id,
    testsId,
  };

  const panelCreated = await addPannel.create(createPannel);

  // Check if the pannel was successfully created
  if (!panelCreated) {
    return res.status(400).json({ message: "Failed to create pannel" });
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
            action: "Staff created a new Pannel",
            panelName: pannelname,
            panelId: panelCreated._id
          },
          reference: {
            model: "panel",
            id: panelCreated._id
          },
          timestamp: new Date()
        }
      }
    });
  }
  // Send a success response
  return res.status(200).json(
    { message: "Pannel created successfully", panelCreated, status: "success" }
  );
});

// superAdmin fetch all Panels 
const allPannelcontroller = asyncHandler(async function (req, res) {
  let query = {};

  if (req.user.role === 'staff') {
    query.createdBy = req.user.parentUser;
    query.createdByRole = 'superAdmin'
  } else {
    query.createdBy = req.user._id
    query.createdByRole = 'superAdmin'
  }
  const allpanels = await addPannel.find(query);

  if (!allpanels) {
    throw new ApiError(400, "internal server error");
  }

  return res.json(allpanels);
});

const onePannelcontroller = asyncHandler(async function (req, res) {

  const { value1 } = req.params;
  // console.log(value1);

  const Apannel = await addPannel
    .findOne({ _id: value1 })
    .populate('testsId', 'Name');

  if (!Apannel) {
    throw new ApiError(404, "Panel not found");
  }

  // Directly update `tests` field for response only
  Apannel.tests = Apannel.testsId.map(obj => obj.Name);

  return res.json(Apannel);
});


// superAdmin editPannel controller
const editPannelController = asyncHandler(async (req, res) => {
  const { value1 } = req.params;

  const {
    final_price,
    pannelname,
    category,
    price,
    inputarray,
    sample_types,
    interpretation,
    hideInterpretation,
    hideMethodInstrument,
    testsId
  } = req.body;

  if (!final_price || !pannelname || !category || !price) {
    return res.status(401).json({ message: "missing required feilds", status: "error" })
  }

  const editedPannel = await addPannel.findOneAndUpdate(
    {
      _id: value1,
    },
    {
      name: pannelname,
      category,
      price,
      tests: inputarray,
      sample_types,
      interpretation,
      hideInterpretation,
      hideMethodInstrument,
      final_price,
      testsId
    },
    { new: true }
  );

  if (!editedPannel) {
    return res.status(401).json({ message: "Something went wrong, please try again", status: "error" })
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
            action: "Staff Update a Pannel",
            panelName: pannelname,
            panelId: editedPannel._id
          },
          reference: {
            model: "panel",
            id: editedPannel._id
          },
          timestamp: new Date()
        }
      }
    });
  }

  return res.status(200).json({ message: "panel edited successfully", status: "success", edited: editedPannel })
});


// Admin editPannel controller
const adminEditPannelController = asyncHandler(async (req, res) => {
  const { value1 } = req.params;

  const {
    final_price,
    pannelname,
    category,
    price,
    inputarray,
    sample_types,
    interpretation,
    hideInterpretation,
    hideMethodInstrument,
    testsId
  } = req.body;

  if (!final_price || !pannelname || !category || !price) {
    return res.status(401).json({ message: "missing required feilds", status: "error" })
  }

  const editedPannel = await addPannel.findOneAndUpdate(
    {
      _id: value1,
    },
    {
      name: pannelname,
      category,
      price,
      tests: inputarray,
      sample_types,
      interpretation: interpretation,
      hideInterpretation,
      hideMethodInstrument,
      final_price,
      testsId
    },
    { new: true }
  );

  if (!editedPannel) {
    return res.status(401).json({ message: "Something went wrong, please try again", status: "error" })
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
            action: "Staff Update a Pannel",
            panelName: pannelname,
            panelId: editedPannel._id
          },
          reference: {
            model: "panel",
            id: editedPannel._id
          },
          timestamp: new Date()
        }
      }
    });
  }

  return res.status(200).json({ message: "panel edited successfully", status: "success", edited: editedPannel })
});

const updatePannelOrder = asyncHandler(async (req, res) => {
  const { updatedOrder } = req.body;
  // console.log(updatedOrder);

  if (!Array.isArray(updatedOrder) || updatedOrder.length === 0) {
    throw new ApiError(400, "Invalid or empty order data");
  }

  try {
    const bulkOperations = await Promise.all(
      updatedOrder.map(async (orderData) => {
        let { id, order } = orderData;

        // If id is a valid MongoDB ObjectId, use it directly
        if (mongoose.isValidObjectId(id)) {
          id = new mongoose.Types.ObjectId(id); // Convert string ObjectId to ObjectId type
        }
        // If id is a numeric value (e.g., '4'), map it to ObjectId by querying the database
        else if (typeof id !== "number") {
          const idofNumber = parseInt(id);
          const panel = await addPannel.findOne({
            order: idofNumber,
            tenantId: req.user.tenantId._id
          }); // Use panel schema here
          if (!panel) {
            throw new ApiError(400, `Panel with order ${id} not found`);
          }
          id = panel._id; // Use the found ObjectId
        } else {
          throw new ApiError(400, `Invalid ObjectId: ${id}`);
        }

        return {
          updateOne: {
            filter: { _id: id },
            update: { order },
          },
        };
      })
    );

    // Execute the bulk write operation
    await addPannel.bulkWrite(bulkOperations); // Use panel schema here

    res.json({
      status: 200,
      message: "Panel order updated successfully",
    });
  } catch (error) {
    console.error("Error updating panel order:", error);
    throw new ApiError(500, "Failed to update panel order");
  }
});

// update panel order super
const updatePannelOrdersuper = asyncHandler(async (req, res) => {
  const { updatedOrder } = req.body;

  if (!Array.isArray(updatedOrder) || updatedOrder.length === 0) {
    throw new ApiError(400, "Invalid or empty order data");
  }

  try {
    const bulkOperations = await Promise.all(
      updatedOrder.map(async (orderData) => {
        let { id, order } = orderData;

        // If id is a valid MongoDB ObjectId, use it directly
        if (mongoose.isValidObjectId(id)) {
          id = new mongoose.Types.ObjectId(id); // Convert string ObjectId to ObjectId type
        }
        // If id is a numeric value (e.g., '4'), map it to ObjectId by querying the database
        else if (typeof id !== "number") {
          const idofNumber = parseInt(id);
          const panel = await addPannel.findOne({
            order: idofNumber,
            createdBy: req.user._id
          }); // Use panel schema here
          if (!panel) {
            throw new ApiError(400, `Panel with order ${id} not found`);
          }
          id = panel._id; // Use the found ObjectId
        } else {
          throw new ApiError(400, `Invalid ObjectId: ${id}`);
        }

        return {
          updateOne: {
            filter: { _id: id },
            update: { order },
          },
        };
      })
    );

    // Execute the bulk write operation
    await addPannel.bulkWrite(bulkOperations); // Use panel schema here

    res.json({
      status: 200,
      message: "Panel order updated successfully",
    });
  } catch (error) {
    console.error("Error updating panel order:", error);
    throw new ApiError(500, "Failed to update panel order");
  }
});

const tenantAllPanel = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId._id; // Assuming tenant is logged in
  const createdBy = req.user._id;

  try {
    const panels = await addPannel.find({
      tenantId: tenantId,
      createdBy: createdBy,
    });

    res.status(200).json({
      status: 200,
      message: "Tests fetched successfully",
      count: panels.length,
      panels,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch tests", error: error.message });
  }
});

export {
  addpannelcontroller,
  allPannelcontroller,
  onePannelcontroller,
  editPannelController,
  updatePannelOrder,
  updatePannelOrdersuper,
  tenantAllPanel,
  addpannelcontrollerforadmin,
  adminEditPannelController,
};
