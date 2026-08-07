// superAdmin.controller.js
import { asyncHandler } from "../utils/asyncHandler.js";
import { SuperAdmin } from "../models/superAdmin.model.js";
import { Tenant } from "../models/tenant.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { Ledger } from "../models/ledger.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";

import mongoose from "mongoose";
import jwt from "jsonwebtoken";

// SuperAdmin Auth Controllers
export const registerSuperAdmin = asyncHandler(async (req, res) => {
  const { username, email, password, fullName, phone } = req.body;
  console.log("Registering Super Admin:", req.body);

  // Validate required fields
  if (!username || !email || !password || !fullName || !phone) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  // Check if super admin already exists
  const existingSuperAdmin = await SuperAdmin.findOne({
    $or: [{ username }, { email }],
  });

  if (existingSuperAdmin) {
    return res.status(409).json({
      success: false,
      message: "Super Admin with this username or email already exists",
    });
  }

  // Create super admin
  const superAdmin = await SuperAdmin.create({
    username,
    email,
    password,
    fullName,
    phoneNo: phone,
    role: "superAdmin",
    
  });

  console.log("Super Admin Created:", superAdmin);

  const createdSuperAdmin = await SuperAdmin.findById(superAdmin._id).select(
    "-password -refreshToken"
  );

  return res.status(201).json({
    success: true,
    message: "Super Admin registered successfully",
    superAdmin: createdSuperAdmin,
  });
});

export const loginSuperAdmin = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!(username || email) || !password) {
    return res.status(400).json({
      success: false,
      message: "Username/email and password are required",
    });
  }

  // Find super admin
  const superAdmin = await SuperAdmin.findOne({
    $or: [{ username }, { email }],
  });

  if (!superAdmin) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  // Check password
  const isPasswordValid = await superAdmin.isPasswordCorrect(password);

  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  // Generate tokens
  const accessToken = superAdmin.generateAccessToken();
  const refreshToken = superAdmin.generateRefreshToken();

  // Update refresh token in database
  superAdmin.refreshToken = refreshToken;
  superAdmin.lastLogin = new Date();
  await superAdmin.save({ validateBeforeSave: false });

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json({
      success: true,
      message: "Super Admin logged in successfully",
      superAdmin: {
        _id: superAdmin._id,
        username: superAdmin.username,
        email: superAdmin.email,
        fullName: superAdmin.fullName,
      },
      accessToken,
    });
});

// टेनेंट मैनेजमेंट कंट्रोलर
export const createTenant = asyncHandler(async (req, res) => {
  // Extract all details from request body
  const {
    name,
    modelType,
    adminDetails,
    subscriptionPlan,
    addressDetails,
    referralCodeProvided,
  } = req.body;

  // Validate required fields
  if (
    !name ||
    !modelType ||
    !adminDetails ||
    !subscriptionPlan ||
    !addressDetails
  ) {
    return res.status(400).json({ message: "All required fields must be provided" });
  }

  // ✅ FIXED: Validate required admin details
  if (
    !adminDetails.username ||
    !adminDetails.email ||
    !adminDetails.password ||
    !addressDetails.fullName
  ) {
    return res.status(400).json({ message: "Username, email, password, and fullName are required" });
  }

  // Check if requesting user is a superadmin
  const requestingUser = req.user;
  // console.log("Requesting User:", requestingUser.role);
  if (requestingUser.role !== "superAdmin") {
    return res.status(403).json({ message: "Only superadmins can assign tenants" });
  }

  // Check if email or username already exists
  const existingUser = await User.findOne({
    $or: [{ email: adminDetails.email }, { username: adminDetails.username }],
  });

  // console.log("Existing User:", existingUser);
  if (existingUser) {
    return res.status(409).json({ message: "Email or username already exists" });
  }

  // ✅ FIXED: Check referral code validity before transaction
  let referrer = null;
  if (referralCodeProvided) {
    referrer = await User.findOne({
      "referral.referralCode": referralCodeProvided,
    });
    if (!referrer) {
      return res.status(400).json({ message: "Invalid referral code provided" });
    }
  }

  // Create unique code for tenant
  const code =
    name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString(36);

  // ✅ FIXED: Add retry logic for write conflicts
  const MAX_RETRIES = 3;
  let attempt = 0;
  
  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();
    session.startTransaction();

    let durationInDays = 30; // default for monthly
    if (subscriptionPlan.planType === "annual") durationInDays = 365;
    if (subscriptionPlan.planType === "quarterly") durationInDays = 90;

    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + durationInDays * 24 * 60 * 60 * 1000
    );

    try {
      // Create tenant
      const tenant = await Tenant.create(
        [
          {
            name,
            modelType,
            code,
            status: "active",
            adminDetails: {
              email: adminDetails.email,
              username: adminDetails.username,
            },
            subscriptionPlan: {
              planType: subscriptionPlan.planType || "monthly",
              startDate: subscriptionPlan.startDate || new Date(),
              endDate: endDate,
              price: subscriptionPlan.price,
              paymentStatus: subscriptionPlan.paymentStatus || "pending",
            },
          },
        ],
        { session }
      );

      // ✅ FIXED: Create admin user data with proper validation
      const adminUserData = {
        username: adminDetails.username.toLowerCase().trim(),
        email: adminDetails.email.toLowerCase().trim(),
        fullName: addressDetails.fullName.toLowerCase().trim(),
        password: adminDetails.password,
        role: "admin",
        bookingWallet: 100000,
        commissionWallet: 0,
        phoneNo: addressDetails.phoneNo ? parseInt(addressDetails.phoneNo) : null,
        state: addressDetails.state?.trim() || "",
        city: addressDetails.city?.trim() || "",
        district: addressDetails.district?.trim() || "",
        postOffice: addressDetails.postOffice?.trim() || "",
        pinCode: addressDetails.pinCode?.trim() || "",
        address: addressDetails.address?.trim() || "",
        createdBy: requestingUser._id,
        parentUser: requestingUser._id,
        parentRole: requestingUser.role,
        tenantId: tenant[0]._id,
        isActive: true,

        // ✅ FIXED: Proper subscription setup
        subscription: {
          plan: subscriptionPlan.planType || "basic",
          amount: subscriptionPlan.price || 2000,
          startDate: startDate,
          endDate: endDate,
          isActive: true,
          autoRenew: false,
          renewalHistory: [],
        },

        // ✅ FIXED: Referral system setup
        referral: {
          referredBy: referrer ? referrer._id : null,
          referralCode: null, // Will be auto-generated in pre-save hook
          referredUsers: [],
          totalReferrals: 0,
          totalCommissionEarned: 0,
        },

        // ✅ Required fields initialization
        refreshToken: null,
        lastLogin: null,
        bookingLedger: [],
        commissionLedger: [],
        permissions: {
          canManageBookings: true,
          canManageTest: true,
          canManagePayments: true,
          canViewReports: true,
          canManageUsers: true,
        },
        createdUsers: [],
        pdfFormat: addressDetails.pdfFormat || "reportFormat",
        activities: [],
        showtestdatabase: addressDetails.showtestdatabase,
        showprintsetting: addressDetails.showprintsetting,
        showRandomBtn: addressDetails.showRandomBtn || false,
      };

      // Create admin user for tenant
      const admin = await User.create([adminUserData], { session });

      // ✅ FIXED: Handle referral within transaction using direct updates
      if (referrer && admin[0]) {
        // ✅ FIXED: Update referrer using session-based operations
        const referralUpdateData = {
          $push: {
            "referral.referredUsers": {
              userId: admin[0]._id,
              joinedAt: new Date(),
              totalCommissionEarned: 0,
            },
            activities: {
              activityType: "other",
              details: {
                type: "new_referral",
                referredUser: adminUserData.fullName,
                referredUserEmail: adminUserData.email,
                referredUserRole: "admin",
                joinedAt: new Date(),
              },
              timestamp: new Date(),
            },
          },
          $inc: {
            "referral.totalReferrals": 1,
          },
          // ✅ Initialize referral fields if they don't exist
          $setOnInsert: {
            "referral.referredBy": referrer.referral?.referredBy || null,
            "referral.referralCode": referrer.referral?.referralCode || null,
            "referral.totalCommissionEarned": referrer.referral?.totalCommissionEarned || 0,
          },
        };

        await User.updateOne(
          { _id: referrer._id },
          referralUpdateData,
          { session, upsert: false }
        );
      }

      // Update tenant with admin user ID
      await Tenant.updateOne(
        { _id: tenant[0]._id },
        { "adminDetails.userId": admin[0]._id },
        { session }
      );

      // Add this new user to the creator's createdUsers array
      await User.updateOne(
        { _id: requestingUser._id },
        { $push: { createdUsers: admin[0]._id } },
        { session }
      );

      // ✅ FIXED: Handle superadmin wallet and ledger
      const currentWallet = Number(requestingUser.bookingWallet) || 0;

      // Record transaction in superadmin's ledger if payment is made
      if (subscriptionPlan.paymentStatus === "paid") {
        const newBalance = currentWallet + subscriptionPlan.price;

        // ✅ FIXED: Create ledger entry properly
        await Ledger.create([{
          userId: requestingUser._id,
          username: requestingUser.username,
          role: requestingUser.role,
          transactionId: `TXN-${Date.now()}`,
          type: "credit",
          amount: subscriptionPlan.price,
          description: `Tenant subscription payment from ${name}`,
          balanceAfterTransaction: newBalance,
          createdAt: new Date(),
        }], { session });

        // Update superadmin's booking wallet
        await User.updateOne(
          { _id: requestingUser._id },
          { bookingWallet: newBalance },
          { session }
        );
      }

      await session.commitTransaction();
      await session.endSession();

      return res.status(201).json({
        success: true,
        message: "Tenant created successfully with admin user",
        tenant: {
          _id: tenant[0]._id,
          name: tenant[0].name,
          modelType: tenant[0].modelType,
          code: tenant[0].code,
          adminDetails: {
            userId: admin[0]._id,
            email: admin[0].email,
            username: admin[0].username,
            referralCode: admin[0].referral.referralCode,
          },
        },
      });

    } catch (error) {
      await session.abortTransaction();
      await session.endSession();

      // ✅ FIXED: Check if it's a write conflict and retry
      if (error.code === 112 && attempt < MAX_RETRIES - 1) {
        attempt++;
        console.log(`Write conflict detected. Retrying... Attempt ${attempt + 1}/${MAX_RETRIES}`);
        // Add a small delay before retry
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        continue;
      }

      console.error("Tenant creation error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create tenant",
        error: error.message,
      });
    }
  }

  // If we've exhausted all retries
  return res.status(500).json({
    success: false,
    message: "Failed to create tenant after multiple attempts",
    error: "Write conflict - please try again",
  });
});

// Get all tenants (for superadmin)
const getAllTenants = asyncHandler(async (req, res) => {
  // Check if requesting user is a superadmin
  const requestingUser = req.user;
  
  const tenants = await Tenant.find().populate({
    path: "adminDetails.userId",
    select: "username email fullName",
  });

  return res
    .status(200)
    .json(new ApiResponse(200, tenants, "Tenants fetched successfully"));
});

// Get tenant by ID
const getTenantById = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  console.log(tenantId);
  if (!tenantId) {
    throw new ApiError(400, "Tenant ID is required");
  }
  const tenant = await Tenant.findById(tenantId).populate({
    path: "adminDetails.userId",
  });

  if (!tenant) {
    throw new ApiError(404, "Tenant not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, tenant, "Tenant fetched successfully"));
});

// Update tenant subscription
const updateTenantSubscription = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  const { planType, endDate, price, paymentStatus } = req.body;

  if (!tenantId) {
    throw new ApiError(400, "Tenant ID is required");
  }

  // Check if requesting user is a superadmin
  const requestingUser = req.user;
  if (requestingUser.role !== "admin") {
    throw new ApiError(403, "Unauthorized access");
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, "Tenant not found");
  }

  // Update subscription details
  const updatedTenant = await Tenant.findByIdAndUpdate(
    tenantId,
    {
      "subscription.planType": planType || tenant.subscription.planType,
      "subscription.endDate": endDate || tenant.subscription.endDate,
      "subscription.price": price || tenant.subscription.price,
      "subscription.paymentStatus":
        paymentStatus || tenant.subscription.paymentStatus,
    },
    { new: true }
  );

  // Record transaction if payment status changed to paid
  if (
    paymentStatus === "paid" &&
    tenant.subscription.paymentStatus !== "paid"
  ) {
    await User.findByIdAndUpdate(requestingUser._id, {
      $push: {
        ledger: {
          transactionId: `TXN-${Date.now()}`,
          type: "credit",
          amount: price || tenant.subscription.price,
          description: `Tenant subscription payment from ${tenant.name}`,
          balanceAfterTransaction:
            requestingUser.wallet + (price || tenant.subscription.price),
        },
      },
      $inc: { wallet: price || tenant.subscription.price },
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedTenant,
        "Tenant subscription updated successfully"
      )
    );
});

const updateAdminById = async (req, res) => {
  try {
    const { tenantId } = req.params; // or req.params.id if route differs
    if (!tenantId)
      return res
        .status(400)
        .json({ success: false, message: "modelId is required" });

    // 1. Fetch tenant and populate admin user
    const tenant = await Tenant.findById(tenantId).populate("adminDetails.userId");
    if (!tenant)
      return res.status(404).json({ success: false, message: "Tenant not found" });

    const adminUser = tenant.adminDetails?.userId;
    if (!adminUser) {
      return res.status(404).json({ success: false, message: "Tenant admin user not found" });
    }

    const userId = adminUser._id;
    console.log("starting body ",req.body,"ending body")
    // 2. Prepare basic updates for User and Tenant
    const userUpdate = {
      fullName: req.body.fullName,
      username: req.body.username,
      email: req.body.email,
      role: req.body.role,
      phoneNo: req.body.phoneNo,
      state: req.body.state,
      district: req.body.district,
      pinCode: req.body.pinCode,
      address: req.body.address,
      bookingWallet: req.body.wallet, // if provided
      isActive: req.body.isActive,
      pdfFormat: req.body.pdfFormat,
      showprintsetting: req.body.showprintsetting,
      showtestdatabase: req.body.showtestdatabase,
      showRandomBtn: req.body.showRandomBtn,
    };

    const tenantUpdate = {
      "subscriptionPlan.planType": req.body.planType,
      "subscriptionPlan.price": req.body.price,
      "subscriptionPlan.paymentStatus": req.body.paymentStatus,
      name: req.body.fullName,
      status: req.body.status,
      "adminDetails.email": req.body.email,
      "adminDetails.username": req.body.username,
    };

    // 3. Apply updates to User
    await User.findByIdAndUpdate(userId, userUpdate, { new: true });

    const findUser = await User.findById(userId);
    if (req.body.password) {
      findUser.password = req.body.password;
      await findUser.save();
    }
    // 4. Handle manual activation / payment

    // Accept either paymentAmount OR manualActivate flag OR paymentStatus === 'paid'
    const paymentAmount = Number(req.body.paymentAmount || 0);
    const manualActivate = req.body.manualActivate === true || req.body.manualActivate === 'true';
    const paymentStatus = req.body.paymentStatus;
    const planType = req.body.planType || tenant.subscriptionPlan?.planType || 'monthly';

    let shouldActivate = false;
    if (manualActivate || paymentStatus === 'paid' || paymentAmount > 0) shouldActivate = true;

    if (shouldActivate) {
      // Compute duration based on planType
      const now = new Date();
      let durationDays = 30; // default monthly
      if (planType === 'quaterly' || planType === 'quarterly') durationDays = 90;
      if (planType === 'yearly' || planType === 'annual') durationDays = 365;

      // Compute new end date by extending existing endDate if subscription is already active
      const tenantCurrentEnd = tenant.subscriptionPlan?.endDate ? new Date(tenant.subscriptionPlan.endDate) : null;
      const userCurrentEnd = adminUser.subscription?.endDate ? new Date(adminUser.subscription.endDate) : null;

      const addedMs = durationDays * 24 * 60 * 60 * 1000;

      let newTenantEnd;
      if (tenantCurrentEnd && tenant.subscriptionPlan?.isActive && tenantCurrentEnd.getTime() > now.getTime()) {
        newTenantEnd = new Date(tenantCurrentEnd.getTime() + addedMs);
      } else {
        newTenantEnd = new Date(now.getTime() + addedMs);
      }

      let newUserEnd;
      if (userCurrentEnd && adminUser.subscription?.isActive && userCurrentEnd.getTime() > now.getTime()) {
        newUserEnd = new Date(userCurrentEnd.getTime() + addedMs);
      } else {
        // If user has no prior subscription, set startDate to now
        newUserEnd = new Date(now.getTime() + addedMs);
      }

      // Update Tenant subscriptionPlan (set startDate to existing start if present and active)
      let tenantStartToSet = (tenant.subscriptionPlan?.isActive && tenant.subscriptionPlan?.startDate) ? tenant.subscriptionPlan.startDate : now;
      let userStartToSet = (adminUser.subscription?.isActive && adminUser.subscription?.startDate) ? adminUser.subscription.startDate : now;

      if (req.body.customStartDate) {
        tenantStartToSet = new Date(req.body.customStartDate);
        userStartToSet = new Date(req.body.customStartDate);
      }
      if (req.body.customEndDate) {
        newTenantEnd = new Date(req.body.customEndDate);
        newUserEnd = new Date(req.body.customEndDate);
      }

      await Tenant.findByIdAndUpdate(tenantId, {
        $set: {
          'subscriptionPlan.isActive': true,
          'subscriptionPlan.paymentStatus': 'paid',
          'subscriptionPlan.startDate': tenantStartToSet,
          'subscriptionPlan.endDate': newTenantEnd,
        }
      }, { new: true });

      // Update admin user's subscription too (preserve existing startDate if active)

      // Create a shared transaction id to use in renewal history and ledger
      const txnId = `TXN-${Date.now()}`;

      await User.findByIdAndUpdate(userId, {
        $set: {
          'subscription.startDate': userStartToSet,
          'subscription.endDate': newUserEnd,
          'subscription.isActive': true,
          isActive: true,
        },
        $push: {
          'subscription.renewalHistory': {
            renewedAt: now,
            amount: paymentAmount || req.body.price || tenant.subscriptionPlan?.price || 0,
            paymentMethod: paymentAmount > 0 ? (req.body.paymentMethod || 'cash') : (req.body.paymentMethod || 'manual'),
            transactionId: txnId,
          },
          activities: {
            activityType: 'subscription_renewal',
            details: {
              amount: paymentAmount || req.body.price || tenant.subscriptionPlan?.price || 0,
              method: paymentAmount > 0 ? (req.body.paymentMethod || 'cash') : 'manual',
              processedBy: req.user?._id || null,
            },
            timestamp: new Date()
          }
        }
      }, { new: true });

      // Create ledger entry and update requesting user's bookingWallet (credit)
      if (paymentAmount > 0 && findUser && findUser._id) {
        // Get fresh requesting user document
        const requestingUser = await User.findById(findUser._id);

        const previousWallet = Number(requestingUser?.bookingWallet || 0);

        const newBalance = previousWallet + paymentAmount;

        // Create central ledger entry (use Ledger model). We won't push into requesting user's bookingLedger.
        await Ledger.create({
          userId: findUser._id,
          username: (requestingUser && requestingUser.username) || (findUser && findUser.username) || 'superAdmin',
          role: (requestingUser && requestingUser.role) || (findUser && findUser.role) || 'superAdmin',
          transactionId: txnId,
          type: 'credit',
          amount: paymentAmount,
          description: `Manual subscription payment for tenant ${tenant.name}`,
          balanceAfterTransaction: newBalance,
          createdAt: new Date(),
        });
      }
    }

    // 5. Update Tenant with general fields
    await Tenant.findByIdAndUpdate(tenantId, { $set: tenantUpdate }, { new: true });

    return res.json({
      success: true,
      message: 'Admin & subscription updated successfully!',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Update failed', error: err.message });
  }
};
// Deactivate tenant
const deactivateTenant = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;

  if (!tenantId) {
    throw new ApiError(400, "Tenant ID is required");
  }

  // Check if requesting user is a superadmin
  const requestingUser = req.user;
  if (requestingUser.role !== "admin") {
    throw new ApiError(403, "Unauthorized access");
  }

  const updatedTenant = await Tenant.findByIdAndUpdate(
    tenantId,
    { isActive: false },
    { new: true }
  );

  if (!updatedTenant) {
    throw new ApiError(404, "Tenant not found");
  }

  // Also deactivate the admin user
  await User.findByIdAndUpdate(updatedTenant.admin, { isActive: false });

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedTenant, "Tenant deactivated successfully")
    );
});

// add staff
const addSuperStaff = asyncHandler(async (req, res) => {
  const { fullName, email, phoneNo, username, password, permissions } =
    req.body;
  const requestingUser = req.user;

  console.log("Requesting User:", requestingUser);
  console.log("Requesting User ID:", requestingUser._id);

  // Validate required field
  if (!fullName || !email || !phoneNo || !username || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }
  // Check if email or username already exists
  const existingUser = await SuperAdmin.findOne({
    $or: [{ email }, { username }],
  });
  if (existingUser) {
    throw new ApiError(400, "Email or username already exists");
  }
  // Create new staff user
  const staff = await SuperAdmin.create({
    username,
    email,
    fullName,
    password,
    role: "staff",
    phoneNo,
    createdBy: requestingUser._id,
    hierarchyPath: "/",
    isActive: true,
    parentRole: requestingUser.role,
    parentUser: requestingUser._id,
    permissions: permissions || {},
  });
  if (!staff) {
    throw new ApiError(500, "Failed to create staff user");
  }
  // Add this new user to the creator's createdUsers array
  // await
  // SuperAdmin.find
  //   .findByIdAndUpdate(requestingUser._id, {
  //     $push: { createdUsers: staff._id },
  //   });
  // Return success response
  return res.status(201).json({
    success: true,

    message: "Staff created successfully",
    staff: {
      _id: staff._id,
      username: staff.username,
      email: staff.email,
      fullName: staff.fullName,
      role: staff.role,
    },
  });
});

const logOutSuperAdmin = asyncHandler(async (req, res) => {
  // Clear cookies and remove refresh token from DB if needed
  const user = req.user;
  if (user) {
    // Remove refreshToken from DB (optional, if you store it)
    user.refreshToken = null;
    await user.save({ validateBeforeSave: false });
  }

  res.clearCookie("accessToken").clearCookie("refreshToken").status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});


// // 1. Get all tenants with pagination and filtering
// app.get('/api/tenants', async (req, res) => {
//     try {
//         const { 
//             page = 1, 
//             limit = 50, 
//             status, 
//             search,
//             sortBy = 'createdAt',
//             sortOrder = 'desc'
//         } = req.query;

//         // Build filter object
//         const filter = {};
//         if (status && status !== 'all') {
//             filter.status = status === 'active' ? 'true' : 'false';
//         }
//         if (search) {
//             filter.$or = [
//                 { name: { $regex: search, $options: 'i' } },
//                 { email: { $regex: search, $options: 'i' } },
//                 { 'adminDetails.email': { $regex: search, $options: 'i' } }
//             ];
//         }

//         // Build sort object
//         const sort = {};
//         sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

//         const options = {
//             page: parseInt(page),
//             limit: parseInt(limit),
//             sort
//         };

//         const tenants = await Tenant.find(filter)
//             .sort(sort)
//             .limit(limit * 1)
//             .skip((page - 1) * limit)
//             .exec();

//         const total = await Tenant.countDocuments(filter);

//         res.json({
//             success: true,
//             data: tenants,
//             pagination: {
//                 current: page,
//                 pages: Math.ceil(total / limit),
//                 total,
//                 limit: parseInt(limit)
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching tenants:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch tenants',
//             error: error.message
//         });
//     }
// });

// // 2. Get tenant by ID
// app.get('/api/tenants/:id', async (req, res) => {
//     try {
//         const tenant = await Tenant.findById(req.params.id);

//         if (!tenant) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Tenant not found'
//             });
//         }

//         // Get booking statistics for this tenant
//         const bookingStats = await NewBooking.aggregate([
//             { $match: { tenantId: new mongoose.Types.ObjectId(req.params.id) } },
//             {
//                 $group: {
//                     _id: null,
//                     totalBookings: { $sum: 1 },
//                     totalRevenue: { $sum: '$total' },
//                     activeBookings: {
//                         $sum: { $cond: [{ $eq: ['$status', 'Confirmed'] }, 1, 0] }
//                     },
//                     completedBookings: {
//                         $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
//                     }
//                 }
//             }
//         ]);

//         const stats = bookingStats[0] || {
//             totalBookings: 0,
//             totalRevenue: 0,
//             activeBookings: 0,
//             completedBookings: 0
//         };

//         res.json({
//             success: true,
//             data: {
//                 ...tenant.toObject(),
//                 bookingStats: stats
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching tenant:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch tenant',
//             error: error.message
//         });
//     }
// });

// ✅ Create Virtual Account for Admin/Franchisee
const createVirtualAccount = asyncHandler(async (req, res) => {
  const { userId, userType } = req.body; // userType: 'admin' or 'franchisee'

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  if (!["admin", "franchisee", "subFranchisee"].includes(user.role)) {
    return res.status(400).json({
      success: false,
      message: "Virtual accounts can only be created for admin, franchisee, or sub-franchisee"
    });
  }

  // Check if virtual account already exists
  if (user.virtualAccount && user.virtualAccount.isActive) {
    return res.status(400).json({
      success: false,
      message: "Virtual account already exists for this user"
    });
  }

  try {
    // Import Razorpay here to avoid circular imports
    const Razorpay = (await import("razorpay")).default;

    // Initialize Razorpay with superadmin credentials
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    // Create virtual account
    const virtualAccount = await razorpay.virtualAccounts.create({
      receivers: {
        types: ["bank_account"]
      },
      description: `Virtual Account for ${user.role}: ${user.fullName || user.username}`,
      customer_id: userId, // Use user ID as customer ID
      notes: {
        userId: userId,
        userRole: user.role,
        userType: userType
      }
    });

    // Update user with virtual account details
    user.virtualAccount = {
      virtualAccountId: virtualAccount.id,
      accountNumber: virtualAccount.receivers[0].account_number,
      ifscCode: virtualAccount.receivers[0].ifsc_code,
      isActive: true,
      createdAt: new Date()
    };

    await user.save();

    await user.logActivity("virtual_account_created", {
      virtualAccountId: virtualAccount.id,
      accountNumber: virtualAccount.receivers[0].account_number,
      ifscCode: virtualAccount.receivers[0].ifsc_code
    });

    res.status(201).json({
      success: true,
      message: "Virtual account created successfully",
      data: {
        virtualAccountId: virtualAccount.id,
        accountNumber: virtualAccount.receivers[0].account_number,
        ifscCode: virtualAccount.receivers[0].ifsc_code,
        userId: userId,
        userName: user.fullName || user.username,
        userRole: user.role
      }
    });

  } catch (error) {
    console.error("Error creating virtual account:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create virtual account",
      error: error.message
    });
  }
});

// ✅ Get Virtual Account Details
const getVirtualAccount = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select('virtualAccount username fullName role');
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      },
      virtualAccount: user.virtualAccount || null
    }
  });
});

// ✅ Get All Virtual Accounts
const getAllVirtualAccounts = asyncHandler(async (req, res) => {
  const users = await User.find({
    role: { $in: ["admin", "franchisee", "subFranchisee"] },
    "virtualAccount.isActive": true
  }).select('username fullName role virtualAccount');

  res.status(200).json({
    success: true,
    data: users.map(user => ({
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      },
      virtualAccount: user.virtualAccount
    }))
  });
});

// ✅ Close Virtual Account
const closeVirtualAccount = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  if (!user.virtualAccount || !user.virtualAccount.isActive) {
    return res.status(400).json({
      success: false,
      message: "No active virtual account found"
    });
  }

  try {
    // Import Razorpay here
    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    // Close virtual account
    await razorpay.virtualAccounts.close(user.virtualAccount.virtualAccountId);

    // Update user
    user.virtualAccount.isActive = false;
    await user.save();

    await user.logActivity("virtual_account_closed", {
      virtualAccountId: user.virtualAccount.virtualAccountId
    });

    res.status(200).json({
      success: true,
      message: "Virtual account closed successfully"
    });

  } catch (error) {
    console.error("Error closing virtual account:", error);
    res.status(500).json({
      success: false,
      message: "Failed to close virtual account",
      error: error.message
    });
  }
});

export {
  // l
  getAllTenants,
  getTenantById,
  updateTenantSubscription,
  deactivateTenant,
  addSuperStaff,
  updateAdminById,
  logOutSuperAdmin,
  createVirtualAccount,
  getVirtualAccount,
  getAllVirtualAccounts,
  closeVirtualAccount,
};

// अन्य कंट्रोलर्स...
