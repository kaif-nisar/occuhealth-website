import { Package } from "../models/addPackage.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { SuperAdmin } from "../models/superAdmin.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";

// add package superAdmin
const addPackagecontroller = asyncHandler(async (req, res) => {
  const {
    final_price,
    testname,
    testSample,
    pannelname,
    pannelSample,
    packageName,
    packageFee,
    packagegender,
    testIds,
    pannelIds
  } = req.body;

  // Check for missing fields
  if (
    !pannelname ||
    !pannelSample ||
    !packageName ||
    !packageFee ||
    !packagegender
  ) {
    return res.status(401).json({ message: "missing required feilds" });
  }
  let superAdminId

  if(req.user.role === 'staff'){
    superAdminId = req.user.parentUser
  }
  else{ 
    superAdminId = req.user._id; // get the super admin id from token
  }


  const allreadyExistedpackage = await Package.findOne({
    createdBy: superAdminId,
    packageName: packageName,
  });

  if (allreadyExistedpackage) {
    return res.status(401).json({ message: "Package already present in database" });
  }

  // Create the pannel in the database
  const createPackage = {
    testSample,
    testname,
    pannelname,
    pannelSample,
    packageName,
    packageFee,
    final_price,
    packageGender: packagegender,
    createdBy: superAdminId, // add the super admin id to the test
    originalPackageId: null,
    isBasePackage: true, // Set to true if this is a base test
    createdByRole: 'superAdmin', // Add the role of the user creating the test
    purchasedFromBasePackage: false,
    tenantId: null, // Set tenantId to null for SuperAdmin tests
    testIds,
    pannelIds
  };

  const packageCreated = await Package.create(createPackage);

  // Check if the pannel was successfully created
  if (!packageCreated) {
    return res.status(403).json({ message: "Something went wrong while creating package" });
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
                          action: "Staff created a new package",
                          packageName: packageName,
                          packageId: packageCreated._id
                      },
                      reference: {
                          model: "package",
                          id: packageCreated._id
                      },
                      timestamp: new Date()
                  }
              }
          });
      }
  // Send a success response
  return res.status(200).json(
    { message: "package created successfully", package: packageCreated }
  );
});

// add package Admin
const addPackagecontrollerforadmin = asyncHandler(async (req, res) => {
  const {
    final_price,
    testname,
    testSample,
    pannelname,
    pannelSample,
    packageName,
    packageFee,
    packagegender,
    testIds,
    pannelIds
  } = req.body;

  // Check for missing fields
  if (
    !pannelname ||
    !pannelSample ||
    !packageName ||
    !packageFee ||
    !packagegender
  ) {
    return res.status(401).json({ message: "missing required feilds" });
  }

 let userId;

  if(req.user.role === 'staff'){
    userId = req.user.parentUser
  }
  else{ 
   userId = req.user._id; // get the super admin id from token
  }

  const tenantid = req.user.tenantId._id;

  const allreadyExistedpackage = await Package.findOne({
    tenantId: tenantid,
    createdByRole: "Admin",
    packageName: packageName,
  });

  if (allreadyExistedpackage) {
    return res.status(401).json({ message: "Package already present in database" });
  }

  // Create the pannel in the database
  const createPackage = {
    testSample,
    testname,
    pannelname,
    pannelSample,
    packageName,
    packageFee,
    final_price,
    packageGender: packagegender,
    createdBy: userId, // add the super admin id to the test
    originalPackageId: null,
    isBasePackage: true, // Set to true if this is a base test
    createdByRole: 'admin', // Add the role of the user creating the test
    purchasedFromBasePackage: false,
    tenantId: tenantid, // Set tenantId to null for SuperAdmin tests
    testIds,
    pannelIds,
  };

  const packageCreated = await Package.create(createPackage);

  // Check if the pannel was successfully created
  if (!packageCreated) {
    return res.status(401).json({ message: "Something went wrong while creating package" });
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
                          action: "Staff created a new package",
                          packageName: packageName,
                          packageId: packageCreated._id
                      },
                      reference: {
                          model: "package",
                          id: packageCreated._id
                      },
                      timestamp: new Date()
                  }
              }
          });
      }
  // Send a success response
  return res.status(200).json(
    { message: "package created successfully", package: packageCreated }
  );
});

const allPackagecontroller = asyncHandler(async function (req, res) {

  
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

  const allpackages = await Package.find(query);

  if (!allpackages) {
    throw new ApiError(400, "internal server error");
  }

  return res.json(allpackages);
});

const onePackagecontroller = asyncHandler(async function (req, res) {
  const { value1 } = req.params;

  const Apackage = await Package.findOne({
    _id: value1,
  }).populate([
    { path: 'testIds', select: 'Name' },
    { path: 'pannelIds', select: 'name' }
  ]);

  if (!Apackage) {
    throw new ApiError(400, "internal server error");
  }

  Apackage.testname = Apackage.testIds.map(obj => obj.Name);
  Apackage.pannelname = Apackage.pannelIds.map(obj => obj.name);

  return res.json(Apackage);
});

// superAdmin packaged edit
const editPackageController = asyncHandler(async (req, res) => {

  const { value1 } = req.params;

  const {
    final_price,
    packageName,
    testname,
    testSample,
    pannelname,
    pannelSample,
    packageFee,
    packagegender,
    testIds,
    pannelIds
  } = req.body;

  // Check for required fields
  if (!value1) {
    return res.status(401).json({ message: "Package name is required" });
  }
  // Find the package by name
  const existingPackage = await Package.findOne({ _id: value1 });

  // If package doesn't exist, throw an error
  if (!existingPackage) {
    return res.status(401).json({ message: "Package not found" });
  }

  // Update package details
  existingPackage.testname = testname || existingPackage.testname;
  existingPackage.testSample = testSample || existingPackage.testSample;
  existingPackage.pannelname = pannelname || existingPackage.pannelname;
  existingPackage.pannelSample = pannelSample || existingPackage.pannelSample;
  existingPackage.packageFee = packageFee || existingPackage.packageFee;
  existingPackage.packageGender =
    packagegender || existingPackage.packageGender;
  existingPackage.packageName = packageName || existingPackage.packageName;
  existingPackage.final_price = final_price || existingPackage.final_price;
  existingPackage.testIds = testIds || existingPackage.testIds;
  existingPackage.pannelIds = pannelIds || existingPackage.pannelIds;

  // Save the updated package
  const updatedPackage = await existingPackage.save();

    if(!updatedPackage){
      return res.status(403).json({message:"something went wrong while updating package"})
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
                            action: "Staff updated a package",
                            packageName: packageName,
                            packageId: updatedPackage._id
                        },
                        reference: {
                            model: "package",
                            id: updatedPackage._id
                        },
                        timestamp: new Date()
                    }
                }
            });
        }
  // Return success response
  return res.json(
    { message: "Package Updated successfully", updatedPackage: updatedPackage }
  );
});

// admin package edit
const adminEditPackageController = asyncHandler(async (req, res) => {

  const { value1 } = req.params;

  const {
    final_price,
    packageName,
    testname,
    testSample,
    pannelname,
    pannelSample,
    packageFee,
    packagegender,
    testIds,
    pannelIds
  } = req.body;

  // Check for required fields
  if (!value1) {
    return res.status(401).json({ message: "Package name is required" });
  }
  // Find the package by name
  const existingPackage = await Package.findOne({ _id: value1 });

  // If package doesn't exist, throw an error
  if (!existingPackage) {
    return res.status(401).json({ message: "Package not found" });
  }

  // Update package details
  existingPackage.testname = testname || existingPackage.testname;
  existingPackage.testSample = testSample || existingPackage.testSample;
  existingPackage.pannelname = pannelname || existingPackage.pannelname;
  existingPackage.pannelSample = pannelSample || existingPackage.pannelSample;
  existingPackage.packageFee = packageFee || existingPackage.packageFee;
  existingPackage.packageGender =
    packagegender || existingPackage.packageGender;
  existingPackage.packageName = packageName || existingPackage.packageName;
  existingPackage.final_price = final_price || existingPackage.final_price;
  existingPackage.testIds = testIds || existingPackage.testIds;
  existingPackage.pannelIds = pannelIds || existingPackage.pannelIds;

  // Save the updated package
  const updatedPackage = await existingPackage.save();

    if(!updatedPackage){
      return res.status(403).json({message:"something went wrong while updating package"})
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
                            action: "Staff updated a package",
                            packageName: packageName,
                            packageId: updatedPackage._id
                        },
                        reference: {
                            model: "package",
                            id: updatedPackage._id
                        },
                        timestamp: new Date()
                    }
                }
            });
        }
  // Return success response
  return res.json(
    { message: "Package Updated successfully", updatedPackage: updatedPackage }
  );
});
const tenantAllPackage = asyncHandler(async (req, res) => {

  const tenantId = req.user.tenantId._id; // Assuming tenant is logged i

  try {
    const packages = await Package.find({
      tenantId: tenantId,
    });

    res.status(200).json({
      status: 200,
      message: "Tests fetched successfully",
      count: packages.length,
      packages,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch tests", error: error.message });
  }
});

export {
  addPackagecontroller,
  allPackagecontroller,
  onePackagecontroller,
  editPackageController,
  tenantAllPackage,
  addPackagecontrollerforadmin,
  adminEditPackageController
};
