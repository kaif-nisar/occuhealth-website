import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Ledger } from "../models/ledger.model.js";
import mongoose from "mongoose";
import { unitdb } from "../models/category.model.js";
import { User } from "../models/user.model.js";
import { Tenant } from "../models/tenant.model.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { SystemSetting } from "../models/systemSetting.model.js";
import { NotificationDelivery } from "../models/notificationDelivery.model.js";
// generate accessToken and refreshToken for user to close session
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    // save refresh token in data base

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      501,
      "something went wrong while generating access and refresh token"
    );
  }
};
// User registration Session

const registerUser = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    username,
    password,
    state,
    city,
    district,
    postOffice,
    pinCode,
    address,
    phoneNo,
    role,
  } = req.body;
  if (
    [fullName, email, username, password, phoneNo].some(
      (field) => field?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const alreadyExist = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (alreadyExist) {
    throw new ApiError(409, "your username and email already exist");
  }
  const user = await User.create({
    fullName,
    username,
    password,
    email,
    role: "admin",
    state,
    city,
    district,
    postOffice,
    pinCode,
    address,
    phoneNo,
    wallet: role == "admin" ? 1000000 : 0,
  });
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong registring the new user");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "user registerd"));
});

// User login session

// ✅ 1. UPDATED LOGIN CONTROLLER - Subscription check at login
const loginUser = asyncHandler(async (req, res) => {

  const { username, email, password } = req.body;
  // Ensure either username or email is provided
  if (!(username || email)) {
    return res.status(400).json({ message: "Email or username is required." });
  }
  // Find user by username or email
  const user = await User.findOne({
    $or: [{ username }, { email }],
  }).populate([{ path: "createdBy", select: "role tenantId" },
  { path: "tenantId" }
  ]);
  // let tenant = user.tenantId
  // tenant = Tenant.findOne({ tenant == "_id"})
  // Check if user exists and password is correct
  if (!user || !(await user.isPasswordCorrect(password))) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  // 🛑 CRITICAL: Block login if franchisee account is locked/inactive by admin
  if (user.isActive === false) {
    return res.status(403).json({
      success: false,
      message: "आपका पोर्टल लॉक हो चुका है, एडमिन से संपर्क करें।",
      accountLocked: true,
    });
  }

  // ✅ CRITICAL: Check subscription but allow login for renewal
  let subscriptionStatus = "active";

  let subscriptionMessage = null;

  if (user.tenantId?.isSubscriptionExpired && user.tenantId.isSubscriptionExpired()) {
    subscriptionStatus = "expired";
    subscriptionMessage = "Your subscription has expired. Renew to access premium features.";
    // Don't deactivate here - let them login to renew
  } else if (user.tenantId?.isSubscriptionExpiringSoon && user.tenantId.isSubscriptionExpiringSoon()) {
    subscriptionStatus = "expiring";
    const endDate = user.tenantId?.subscriptionPlan?.endDate || user.subscription?.endDate;
    const daysLeft = Math.ceil(
      (new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24)
    );
    subscriptionMessage = `Your subscription expires in ${daysLeft} days`;
  }

  // ✅ Allow login even if subscription expired (for renewal process)
  // Only block if account is manually deactivated by admin
  if (user.tenantId && user.tenantId.status !== "active") {
    return res.status(403).json({
      success: false,
      message: "Your account has been deactivated. Please contact support.",
      accountDeactivated: true,
    });
  }

  let parent;
  if (!user.parentUser && user.createdBy) {
    user.parentUser = user.createdBy;
  }
  // Update last login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  // Generate access and refresh tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const tenantSub = user.tenantId?.subscriptionPlan || {};
  const userSub = user.subscription || {};

  // Create user data for frontend
  const userData = {
    _id: user._id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.createdBy?.role || user.role,
    myrole: user.role,
    modelType: user.parentUser?.tenantId?.modelType || user.tenantId?.modelType,
    verification: {
      emailVerified: user.emailVerified === true,
      phoneVerified: user.phoneVerified === true,
      emailVerifiedAt: user.emailVerifiedAt || null,
      phoneVerifiedAt: user.phoneVerifiedAt || null,
      whatsappOptIn: user.notificationPreferences?.whatsapp?.userOptIn === true || user.whatsappOptIn === true,
    },
    subscription: {
      plan: tenantSub.planType || tenantSub.planDuration || userSub.plan,
      isActive: tenantSub.isActive !== undefined ? tenantSub.isActive : userSub.isActive,
      endDate: tenantSub.endDate || userSub.endDate,
      isExpiringSoon: typeof user.tenantId?.isSubscriptionExpiringSoon === 'function' ? user.tenantId.isSubscriptionExpiringSoon() : false,
    },
  };

  // Cookie options for production
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Only HTTPS in production
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  };

  // Set cookies
  res.cookie("refreshToken", refreshToken, options);
  res.cookie("accessToken", accessToken, options);

  // Send response with subscription warning if needed
  const response = {
    statusCode: 200,
    accessToken,
    refreshToken,
    userData,
    message: "User logged in successfully",
    success: true,
  };

  // // Add subscription warning if expiring soon
  // if (user.isSubscriptionExpiringSoon()) {
  //   const daysLeft = Math.ceil(
  //     (user.subscription.endDate - new Date()) / (1000 * 60 * 60 * 24)
  //   );
  //   response.subscriptionWarning = {
  //     message: `Your subscription expires in ${daysLeft} days`,
  //     daysLeft: daysLeft,
  //     renewalUrl: "/renew-subscription",
  //   };
  // }

  return res.status(200).json({
    statusCode: 200,
    accessToken,
    refreshToken,
    userData,
    message: "User logged in successfully",
    success: true,
    ...(typeof user.tenantId?.isSubscriptionExpiringSoon === 'function' && user.tenantId.isSubscriptionExpiringSoon() && {
      subscriptionWarning: {
        message: subscriptionMessage,
        daysLeft: Math.ceil(
          (new Date(tenantSub.endDate || userSub.endDate) - new Date()) / (1000 * 60 * 60 * 24)
        ),
        renewalUrl: "/renew-subscription",
      },
    }),
  });
});

//user logout functnality
const logOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

// Get current user details
const getCurrentUser = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized - User not found in request");
  }

  const user = await User.findById(req.user._id).select(
    "-password -refreshToken"
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(
    new ApiResponse(200, user, "Current user retrieved successfully")
  );
});

// GENRATER ACCESS TOKEN AGAIN BASE ON REFRESH TOKEN FOR LOGIN LAST EVENT
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incommingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incommingRefreshToken) {
    throw new ApiError(402, "unathorized access");
  }

  try {
    const decodedToken = jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(402, "invalid refresh Token");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access Token Refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }
});

// superFranchisee create
const superFranchiseeCreate = asyncHandler(async (req, res) => {
  try {
    const {
      username,
      email,
      fullName,
      role,
      password,
      phoneNo,
      address,
      pinCode,
      state,
      city,
      district,
      postOffice,
    } = req.body;
    // Get creator's information
    let userId;
    let userRole;
    if (req.user.role === "staff") {
      // Agar staff hai to parentUser ke according test lana hai
      userId = req.user.parentUser;
      userRole = req.user.parentRole;
    } else {
      userId = req.user._id;
      userRole = req.user.role;
    }
    const creator = req.user;
    const tenantId = creator.tenantId;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedPhoneNumber = String(phoneNo || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "A valid email is required" });
    }
    if (!/^\+[1-9]\d{9,14}$/.test(normalizedPhoneNumber)) {
      return res.status(400).json({ success: false, message: "Phone number must include country code, for example +919876543210" });
    }
    // Check if user has permission to create this role

    const canCreate = checkCreationPermission(
      userRole,
      role,
      tenantId.modelType
    );
    console.log("canCreate", canCreate);

    if (!canCreate) {
      return res.status(403).json({
        success: false,
        message: `As a ${creator.role}, you don't have permission to create a ${role}`,
      });
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username or Email already exists",
      });
    }

    // Create new user
    const newUser = await User.create({
      username: (req.user.username + username),
      email,
      normalizedEmail,
      fullName,
      role,
      password,
      phoneNo,
      phoneNumber: normalizedPhoneNumber,
      normalizedPhoneNumber,
      address,
      pinCode,
      state,
      city,
      district,
      postOffice,
      parentUser: userId,
      parentRole: creator.role,
      tenantId: tenantId._id,
      createdBy: userId,
      emailVerified: false,
      phoneVerified: false,
    });

    if (!newUser) {
      res.status(402).json({ message: "Something went wrong creating franchisee" })
    }
    // Update the creator's createdUsers array
    await User.findByIdAndUpdate(userId, {
      $push: { createdUsers: newUser._id },
    });

    // Update tenant analytics
    await Tenant.findByIdAndUpdate(tenantId._id, {
      $inc: { "analytics.totalUsers": 1 },
    });

    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          activities: {
            activityType: "user_management",
            details: {
              staffId: req.user._id,
              staffName: req.user.fullName,
              action: `${req.user.fullName} created has new franchisee`,
              franchiseeName: fullName,
              franchiseeId: newUser._id
            },
            reference: {
              model: "franchisee",
              id: newUser._id
            },
            timestamp: new Date()
          }
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: `${role} created successfully`,
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        fullName: newUser.fullName,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Helper function to check if user can create specific role
function checkCreationPermission(creatorRole, newRole, modelType) {
  // console.log(creatorRole, newRole, modelType)
  // Create a hierarchy of roles
  const roleHierarchy = {
    admin: ["superFranchisee", "franchisee", "subFranchisee"],
    superFranchisee: ["franchisee", "subFranchisee"],
    franchisee: ["subFranchisee"],
    subFranchisee: [],
  };

  // Check if creator can create this role
  if (!roleHierarchy[creatorRole].includes(newRole)) {
    console.log(`Role ${creatorRole} cannot create ${newRole} we are fail`);
    return false;
  }

  // Check model type restrictions
  switch (modelType) {
    case "1layer":
      // Admin can only create regular users, not franchisees
      return false;
    case "2layer":
      // Admin can create superFranchisees only
      return newRole === "superFranchisee";
    case "3layer":
      // Only allow creating roles up to franchisee level
      return newRole !== "superFranchisee";
    case "4layer":
      // All roles can be created
      return true;
    default:
      return false;
  }
}

const getMyFranchisees = asyncHandler(async (req, res) => {
  // Assuming you have user info in req.user
  let userId;
  if (req.user.role === 'staff') {
    userId = req.user.parentUser;
  } else {
    userId = req.user._id;
  }
  const tid = req.user.tenantId._id;
  const franchisees = await User.find({
    tenantId: tid,
    createdBy: userId,
    role: { $ne: 'staff' }
  })
    .select("-password -refreshToken") // Exclude sensitive info
    .populate("createdUsers", "fullName username"); // Optionally populate created users

  if (!franchisees.length) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "No franchisees found"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { success: true },
        franchisees,
        "Get franchisee successfully"
      )
    );
  // return res.status(200).json(new ApiResponse(200, franchisees, "Franchisees retrieved successfully"));
});

// Toggle franchisee active/inactive status (Lock/Unlock)
const toggleFranchiseeStatus = asyncHandler(async (req, res) => {
  const { franchiseeId } = req.params;
  const { isActive } = req.body;

  if (!franchiseeId) {
    return res.status(400).json({
      success: false,
      message: "Franchisee ID is required"
    });
  }

  // Find the franchisee
  const franchisee = await User.findById(franchiseeId);
  if (!franchisee) {
    return res.status(404).json({
      success: false,
      message: "Franchisee not found"
    });
  }

  // 🛑 CRITICAL: Enforce tenant isolation - target must belong to same tenant
  assertSameTenant(req.user, franchisee);

  // Determine new status (toggle if not provided)
  const newStatus = typeof isActive === 'boolean' ? isActive : !franchisee.isActive;

  // Update the franchisee status
  franchisee.isActive = newStatus;
  await franchisee.save({ validateBeforeSave: false });

  // Log activity
  await franchisee.logActivity(
    "user_management",
    {
      action: newStatus ? "unlocked" : "locked",
      performedBy: req.user._id,
      performedByName: req.user.fullName,
      timestamp: new Date()
    },
    { model: "franchisee", id: franchisee._id }
  );

  return res.status(200).json({
    success: true,
    message: newStatus ? "Franchisee unlocked successfully" : "Franchisee locked successfully",
    data: {
      _id: franchisee._id,
      isActive: franchisee.isActive,
      fullName: franchisee.fullName
    }
  });
});

// Utility function to generate transaction number

function generateTransactionNumber() {
  const prefix = "#CR";
  const timestamp = Date.now().toString(); // Current timestamp as a unique number
  return prefix + timestamp;
}

// Helper to validate that a target user belongs to the same tenant as the authenticated user
// This is a critical multi-tenant isolation guard for all wallet/credit transfer endpoints.
const assertSameTenant = (authUser, targetUser) => {
  const authTenantId = authUser?.tenantId?._id?.toString() || authUser?.tenantId?.toString();
  const targetTenantId = targetUser?.tenantId?.toString();
  if (!authTenantId || !targetTenantId || authTenantId !== targetTenantId) {
    throw new ApiError(
      403,
      "Forbidden: Target user does not belong to your tenant"
    );
  }
};

// Send money from Admin to Super Franchisee
const moneyDebitFromSuperFranchisee = asyncHandler(async (req, res) => {

  const { adminId, superId, amount } = req.body;

  console.log("adminId:", adminId);
  console.log("superID:", superId);
  console.log("amount:", amount);
  console.log(typeof adminId);
  console.log(typeof superId);
  const admin = await User.findById(adminId);
  const superFranchisee = await User.findById(superId);

  if (!admin || !superFranchisee) {
    return res
      .status(404)
      .json({ message: "Admin or Super Franchisee not found" });
  }

  // 🛑 CRITICAL: Enforce tenant isolation - target must belong to same tenant
  assertSameTenant(req.user, superFranchisee);

  if (admin.bookingWallet < amount) {
    return res.status(400).json({ message: "Insufficient admin balance" });
  }

  admin.bookingWallet -= amount;
  superFranchisee.bookingWallet += amount;

  await admin.save();
  await superFranchisee.save();

  const transactionNumber = generateTransactionNumber();

  // Create ledger entry for Admin
  await Ledger.create({
    userId: admin._id,
    amount: amount,
    type: "debit",
    description: `Transferred to Super Franchisee ID: ${superFranchisee._id}`,
    balanceAfterTransaction: admin.bookingWallet,
    transactionId: transactionNumber,
    remarks: `Online payment`,
    username: `${admin.username}/${superFranchisee.username}`,
  });

  // Create ledger entry for Super Franchisee
  await Ledger.create({
    userId: superFranchisee._id,
    amount: amount,
    type: "credit",
    description: `Received from Admin ID: ${admin._id}`,
    balanceAfterTransaction: superFranchisee.bookingWallet,
    transactionId: transactionNumber,
    remarks: `Online Payment`,
    username: `${superFranchisee.username}/${admin.username}`,
  });
  if (req.user.role === 'staff') {
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        activities: {
          activityType: "payment",
          details: {
            staffId: req.user._id,
            staffName: req.user.fullName,
            action: "Staff Deduct money to Franchisee",
            franchiseeName: superFranchisee.fullName,
            franchiseeId: superFranchisee._id,
            Amount: amount
          },
          reference: {
            model: "franchisee",
            id: superFranchisee._id
          },
          timestamp: new Date()
        }
      }
    });
  }
  return res.status(200).json({ 
    success: true,
    data: {
      adminWallet: admin.bookingWallet
    }
   });
});

const moneyDebitFromFranchisee = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { adminId, franchiseeId, amount } = req.body;

    // 🛑 Validation
    if (!amount || amount <= 0) {
      throw new Error("Invalid transfer amount");
    }

    const admin = await User.findById(adminId).session(session);
    const franchisee = await User.findById(franchiseeId).session(session);

    if (!admin || !franchisee) {
      throw new Error("Admin or Franchisee not found");
    }

    // 🛑 CRITICAL: Enforce tenant isolation - target must belong to same tenant
    assertSameTenant(req.user, franchisee);

    // 🛑 Check franchisee balance (IMPORTANT FIX)
    if (franchisee.bookingWallet < amount) {
      throw new Error("Franchisee has insufficient balance");
    }

    // 💸 TRANSFER (Franchisee ➜ Admin)
    franchisee.bookingWallet -= amount; // debit from franchisee
    admin.bookingWallet += amount;      // credit to admin

    await franchisee.save({ session });
    await admin.save({ session });

    const transactionNumber = generateTransactionNumber();

    // 📒 Ledger — Franchisee (DEBIT)
    await Ledger.create([{
      userId: franchisee._id,
      amount: amount,
      type: "debit",
      description: `Transferred to Admin ID: ${admin._id}`,
      balanceAfterTransaction: franchisee.bookingWallet,
      transactionId: transactionNumber,
      remarks: "Wallet Transfer",
      username: `${franchisee.username}/${admin.username}`,
    }], { session });

    // 📒 Ledger — Admin (CREDIT)
    await Ledger.create([{
      userId: admin._id,
      amount: amount,
      type: "credit",
      description: `Received from Franchisee ID: ${franchisee._id}`,
      balanceAfterTransaction: admin.bookingWallet,
      transactionId: transactionNumber,
      remarks: "Wallet Transfer",
      username: `${admin.username}/${franchisee.username}`,
    }], { session });

    // 👨‍💼 Staff Activity Log
    if (req.user.role === "staff") {
      await User.findByIdAndUpdate(
        req.user._id,
        {
          $push: {
            activities: {
              activityType: "payment",
              details: {
                staffId: req.user._id,
                staffName: req.user.fullName,
                action: "Staff collected money from Franchisee",
                franchiseeName: franchisee.fullName,
                franchiseeId: franchisee._id,
                amount: amount,
              },
              reference: {
                model: "franchisee",
                id: franchisee._id,
              },
              timestamp: new Date(),
            },
          },
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Money debited from Franchisee to Admin successfully",
      data: {
        adminWallet: admin.bookingWallet,
        franchiseeWallet: franchisee.bookingWallet,
        transactionId: transactionNumber,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ message: error.message });
  }
});

const moneyDebitFromSubFranchisee = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { adminId, subId, amount } = req.body;

    // 🛑 Validation
    if (!amount || amount <= 0) {
      throw new Error("Invalid transfer amount");
    }

    const admin = await User.findById(adminId).session(session);
    const subFranchisee = await User.findById(subId).session(session);

    if (!admin || !subFranchisee) {
      throw new Error("Admin or Sub Franchisee not found");
    }

    // 🛑 CRITICAL: Enforce tenant isolation - target must belong to same tenant
    assertSameTenant(req.user, subFranchisee);

    // 🛑 Check Sub balance (FIX)
    if (subFranchisee.bookingWallet < amount) {
      throw new Error("Sub Franchisee has insufficient balance");
    }

    // 💸 TRANSFER (Sub ➜ Admin)
    subFranchisee.bookingWallet -= amount; // debit from sub
    admin.bookingWallet += amount;        // credit to admin

    await subFranchisee.save({ session });
    await admin.save({ session });

    const transactionNumber = generateTransactionNumber();

    // 📒 Ledger — Sub Franchisee (DEBIT)
    await Ledger.create([{
      userId: subFranchisee._id,
      amount: amount,
      type: "debit",
      description: `Transferred to Admin ID: ${admin._id}`,
      balanceAfterTransaction: subFranchisee.bookingWallet,
      transactionId: transactionNumber,
      remarks: "Wallet Transfer",
      username: `${subFranchisee.username}/${admin.username}`,
    }], { session });

    // 📒 Ledger — Admin (CREDIT)
    await Ledger.create([{
      userId: admin._id,
      amount: amount,
      type: "credit",
      description: `Received from Sub Franchisee ID: ${subFranchisee._id}`,
      balanceAfterTransaction: admin.bookingWallet,
      transactionId: transactionNumber,
      remarks: "Wallet Transfer",
      username: `${admin.username}/${subFranchisee.username}`,
    }], { session });

    // 👨‍💼 Staff Activity Log
    if (req.user.role === "staff") {
      await User.findByIdAndUpdate(
        req.user._id,
        {
          $push: {
            activities: {
              activityType: "payment",
              details: {
                staffId: req.user._id,
                staffName: req.user.fullName,
                action: "Staff collected money from Sub Franchisee",
                franchiseeName: subFranchisee.fullName,
                franchiseeId: subFranchisee._id,
                amount: amount,
              },
              reference: {
                model: "franchisee",
                id: subFranchisee._id,
              },
              timestamp: new Date(),
            },
          },
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Money debited from Sub Franchisee to Admin successfully",
      data: {
        adminWallet: admin.bookingWallet,
        subFranchiseeWallet: subFranchisee.bookingWallet,
        transactionId: transactionNumber,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ message: error.message });
  }
});


// Debit money from Super Franchisee back to Admin
const moneySendToSuperFranchisee = asyncHandler(async (req, res) => {
  const { adminId, superId, amount } = req.body;

  const admin = await User.findById(adminId);
  const superFranchisee = await User.findById(superId);

  if (!admin || !superFranchisee) {
    return res
      .status(404)
      .json({ message: "Admin or Super Franchisee not found" });
  }

  // 🛑 CRITICAL: Enforce tenant isolation - target must belong to same tenant
  assertSameTenant(req.user, superFranchisee);

  superFranchisee.bookingWallet -= amount; // Reduce from Super Franchisee
  admin.bookingWallet += amount; // Add to Admin

  await admin.save();
  await superFranchisee.save();

  const transactionNumber = generateTransactionNumber();

  // Create ledger entry for Admin (Credit)
  await Ledger.create({
    userId: admin._id,
    amount: amount,
    type: "credit",
    description: `Received from Super Franchisee ID: ${superFranchisee._id}`,
    balanceAfterTransaction: admin.bookingWallet,
    transactionId: transactionNumber,
    remarks: `Online Payment`,
    username: `${admin.username}/${superFranchisee.username}`,
  });

  // Create ledger entry for Super Franchisee (Debit)
  await Ledger.create({
    userId: superFranchisee._id,
    amount: amount,
    type: "debit",
    description: `Transferred to Admin ID: ${admin._id}`,
    balanceAfterTransaction: superFranchisee.bookingWallet,
    transactionId: transactionNumber,
    remarks: `Online Payment`,
    username: `${superFranchisee.username}/${admin.username}`,
  });
  if (req.user.role === 'staff') {
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        activities: {
          activityType: "payment",
          details: {
            staffId: req.user._id,
            staffName: req.user.fullName,
            action: "Staff Send money to Franchisee",
            franchiseeName: superFranchisee.fullName,
            franchiseeId: superFranchisee._id,
            Amount: amount
          },
          reference: {
            model: "franchisee",
            id: superFranchisee._id
          },
          timestamp: new Date()
        }
      }
    });
  }
  return res.status(200).json({ success: true, data: { adminWallet: admin.bookingWallet } });
});

// Assign money from Admin to Franchisee
const moneySendToFranchisee = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { franchiseeId, amount, remarks } = req.body;

    // Input validation
    if (!franchiseeId) {
      return res.status(400).json({
        success: false,
        message: "Franchisee ID is required"
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required"
      });
    }

    // Parse amount to number
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount)) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a valid number"
      });
    }

    const adminId = req.user.role === "staff" ? req.user.parentUser._id : req.user._id;
    // Find admin and franchisee
    const admin = await User.findById(adminId).session(session);
    const franchisee = await User.findById(franchiseeId).session(session);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found"
      });
    }

    if (!franchisee) {
      return res.status(404).json({
        success: false,
        message: "Franchisee not found"
      });
    }

    // 🛑 CRITICAL: Enforce tenant isolation - target must belong to same tenant
    assertSameTenant(req.user, franchisee);

    // Check if admin has sufficient balance
    if (admin.bookingWallet < parsedAmount) {
      console.log("Admin balance:", admin.bookingWallet, "Requested amount:", parsedAmount);
      return res.status(400).json({
        success: false,
        message: "Insufficient balance in your wallet",
        currentBalance: admin.bookingWallet,
        requestedAmount: parsedAmount
      });
    }

    // Calculate new balances
    const adminNewBalance = admin.bookingWallet - parsedAmount;
    const franchiseeNewBalance = franchisee.bookingWallet + parsedAmount;

    // Generate transaction ID
    const transactionNumber = generateTransactionNumber();

    // Update wallets
    admin.bookingWallet = adminNewBalance;
    franchisee.bookingWallet = franchiseeNewBalance;

    // Save both users
    await admin.save({ session });
    await franchisee.save({ session });

    // Create ledger entry for Admin (Debit - money going out)
    const adminLedgerEntry = new Ledger({
      userId: admin._id,
      username: admin.username,
      amount: parsedAmount,
      type: "debit",
      description: `Amount assigned to Franchisee: ${franchisee.fullName || franchisee.username}`,
      balanceAfterTransaction: adminNewBalance,
      transactionId: transactionNumber,
      remarks: remarks || `Amount assignment to franchisee`,
      receivedBy: franchisee.username,
      assignedTo: franchiseeId,
      transactionType: "wallet_assignment"
    });

    await adminLedgerEntry.save({ session });

    // Create ledger entry for Franchisee (Credit - money coming in)
    const franchiseeLedgerEntry = new Ledger({
      userId: franchisee._id,
      username: franchisee.username,
      amount: parsedAmount,
      type: "credit",
      description: `Amount received from Admin: ${admin.fullName || admin.username}`,
      balanceAfterTransaction: franchiseeNewBalance,
      transactionId: transactionNumber,
      remarks: remarks || `Amount received from admin`,
      receivedFrom: admin.username,
      assignedBy: admin._id,
      transactionType: "wallet_assignment"
    });

    await franchiseeLedgerEntry.save({ session });

    // Log staff activity if user is staff
    if (req.user.role === 'staff') {
      await User.findByIdAndUpdate(
        req.user._id,
        {
          $push: {
            activities: {
              activityType: "payment",
              details: {
                staffId: req.user._id,
                staffName: req.user.fullName || req.user.username,
                action: "Amount assigned to Franchisee",
                franchiseeName: franchisee.fullName || franchisee.username,
                franchiseeId: franchisee._id,
                amount: parsedAmount,
                transactionId: transactionNumber
              },
              reference: {
                model: "User",
                id: franchisee._id
              },
              timestamp: new Date()
            }
          }
        },
        { session }
      );
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Amount assigned successfully",
      data: {
        transactionId: transactionNumber,
        adminWallet: adminNewBalance,
        franchiseeWallet: franchiseeNewBalance,
        assignedAmount: parsedAmount,
        franchiseeDetails: {
          id: franchisee._id,
          name: franchisee.fullName || franchisee.username,
          newBalance: franchiseeNewBalance
        }
      }
    });

  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    session.endSession();

    console.error("Error in assignAmountToFranchisee:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error while assigning amount",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Alternative function for deducting amount from franchisee (if needed)
const deductAmountFromFranchisee = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { franchiseeId, amount, remarks } = req.body;

    // Input validation
    if (!franchiseeId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid franchisee ID and amount are required"
      });
    }

    const parsedAmount = Number(amount);

    const admin = await User.findById(req.user._id).session(session);
    const franchisee = await User.findById(franchiseeId).session(session);

    if (!admin || !franchisee) {
      return res.status(404).json({
        success: false,
        message: "Admin or Franchisee not found"
      });
    }

    // Check if franchisee has sufficient balance
    if (franchisee.bookingWallet < parsedAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance in franchisee wallet",
        currentBalance: franchisee.bookingWallet,
        requestedAmount: parsedAmount
      });
    }

    const transactionNumber = generateTransactionNumber();

    // Deduct from franchisee, add to admin
    franchisee.bookingWallet -= parsedAmount;
    admin.bookingWallet += parsedAmount;

    await admin.save({ session });
    await franchisee.save({ session });

    // Create ledger entries
    const adminLedgerEntry = new Ledger({
      userId: admin._id,
      username: admin.username,
      amount: parsedAmount,
      type: "credit",
      description: `Amount received from Franchisee: ${franchisee.fullName || franchisee.username}`,
      balanceAfterTransaction: admin.bookingWallet,
      transactionId: transactionNumber,
      remarks: remarks || `Amount deducted from franchisee`,
      receivedFrom: franchisee.username
    });

    const franchiseeLedgerEntry = new Ledger({
      userId: franchisee._id,
      username: franchisee.username,
      amount: parsedAmount,
      type: "debit",
      description: `Amount transferred to Admin: ${admin.fullName || admin.username}`,
      balanceAfterTransaction: franchisee.bookingWallet,
      transactionId: transactionNumber,
      remarks: remarks || `Amount transferred to admin`,
      transferredTo: admin.username
    });

    await adminLedgerEntry.save({ session });
    await franchiseeLedgerEntry.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Amount deducted successfully",
      data: {
        transactionId: transactionNumber,
        adminWallet: admin.bookingWallet,
        franchiseeWallet: franchisee.bookingWallet,
        deductedAmount: parsedAmount
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error in deductAmountFromFranchisee:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error while deducting amount",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

const moneySendToSubFranchisee = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { adminId, subId, amount } = req.body;

    // 🛑 Basic validation
    if (!amount || amount <= 0) {
      throw new Error("Invalid amount");
    }

    const admin = await User.findById(adminId).session(session);
    const subFranchisee = await User.findById(subId).session(session);

    if (!admin || !subFranchisee) {
      throw new Error("Admin or Sub Franchisee not found");
    }

    // 🛑 CRITICAL: Enforce tenant isolation - target must belong to same tenant
    assertSameTenant(req.user, subFranchisee);

    // 🛑 Balance check
    if (admin.bookingWallet < amount) {
      throw new Error("Admin wallet has insufficient balance");
    }

    // 💸 Wallet Transfer (Admin ➜ Sub)
    admin.bookingWallet -= amount;
    subFranchisee.bookingWallet += amount;

    await admin.save({ session });
    await subFranchisee.save({ session });

    const transactionNumber = generateTransactionNumber();

    // 📒 Ledger — Admin (DEBIT)
    await Ledger.create([{
      userId: admin._id,
      amount: amount,
      type: "debit",
      description: `Transferred to Sub Franchisee ID: ${subFranchisee._id}`,
      balanceAfterTransaction: admin.bookingWallet,
      transactionId: transactionNumber,
      remarks: "Wallet Transfer",
      username: `${admin.username}/${subFranchisee.username}`,
    }], { session });

    // 📒 Ledger — Sub Franchisee (CREDIT)
    await Ledger.create([{
      userId: subFranchisee._id,
      amount: amount,
      type: "credit",
      description: `Received from Admin ID: ${admin._id}`,
      balanceAfterTransaction: subFranchisee.bookingWallet,
      transactionId: transactionNumber,
      remarks: "Wallet Transfer",
      username: `${subFranchisee.username}/${admin.username}`,
    }], { session });

    // 👨‍💼 Staff Activity Log
    if (req.user.role === "staff") {
      await User.findByIdAndUpdate(
        req.user._id,
        {
          $push: {
            activities: {
              activityType: "payment",
              details: {
                staffId: req.user._id,
                staffName: req.user.fullName,
                action: "Staff sent money to Sub Franchisee",
                franchiseeName: subFranchisee.fullName,
                franchiseeId: subFranchisee._id,
                Amount: amount,
              },
              reference: {
                model: "franchisee",
                id: subFranchisee._id,
              },
              timestamp: new Date(),
            },
          },
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Money transferred successfully",
      data: {
        adminWallet: admin.bookingWallet,
        subFranchiseeWallet: subFranchisee.bookingWallet,
        transactionId: transactionNumber,
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ message: error.message });
  }
});

// fetch  all franchisee
const fetchAllFranchisee = asyncHandler(async (req, res) => {
  // The authenticated user's tenant is ALWAYS the source of truth.
  const authTenantId = req.user.tenantId?._id?.toString() || req.user.tenantId?.toString();

  // If a tenantId query param is provided, it MUST match the authenticated user's tenant.
  // This is defense-in-depth: even if a client passes another tenant's ID, we reject it.
  const requestedTenantId = req.query.tenantId;
  if (requestedTenantId && requestedTenantId.toString() !== authTenantId) {
    throw new ApiError(
      403,
      "Forbidden: Tenant ID does not match your tenant"
    );
  }

  // Fetch all users for the tenant but exclude users with role 'staff'
  const franchisees = await User.find({
    tenantId: authTenantId,
    role: { $ne: 'staff' }
  })
    .select('-password -refreshToken'); // hide sensitive fields

  if (!franchisees || franchisees.length === 0) {
    return res.status(404).json(new ApiResponse(404, null, "No franchisees found"));
  }

  return res.status(200).json(new ApiResponse(200, franchisees, "Franchisee"));
});

// Fetch franchisee chain for the current user
// This recursively collects ALL franchisees created by the current user,
// plus franchisees created by those franchisees, and so on down the entire chain.
const fetchFranchiseeChain = asyncHandler(async (req, res) => {
  // The authenticated user's tenant is ALWAYS the source of truth.
  const authTenantId = req.user.tenantId?._id?.toString() || req.user.tenantId?.toString();

  // If a tenantId query param is provided, it MUST match the authenticated user's tenant.
  const requestedTenantId = req.query.tenantId;
  if (requestedTenantId && requestedTenantId.toString() !== authTenantId) {
    throw new ApiError(
      403,
      "Forbidden: Tenant ID does not match your tenant"
    );
  }

  // Determine the starting user:
  // - If the current user is staff, start from their parentUser
  // - Otherwise start from the current user themselves
  let startUserId;
  if (req.user.role === 'staff' && req.user.parentUser) {
    startUserId = req.user.parentUser;
  } else {
    startUserId = req.user._id;
  }

  // Recursively collect all franchisees in the chain
  const collectChainFranchisees = async (parentUserId, visited = new Set()) => {
    const parentIdStr = parentUserId.toString();
    if (visited.has(parentIdStr)) return [];
    visited.add(parentIdStr);

    // Find all users directly created by this parent user (excluding staff)
    const directFranchisees = await User.find({
      tenantId: authTenantId,
      createdBy: parentUserId,
      role: { $ne: 'staff' }
    }).select('-password -refreshToken');

    let allFranchisees = [...directFranchisees];

    // Recursively find franchisees created by each direct franchisee
    for (const franchisee of directFranchisees) {
      const subFranchisees = await collectChainFranchisees(franchisee._id, visited);
      allFranchisees = [...allFranchisees, ...subFranchisees];
    }

    return allFranchisees;
  };

  const franchisees = await collectChainFranchisees(startUserId);

  if (!franchisees || franchisees.length === 0) {
    return res.status(404).json(new ApiResponse(404, null, "No franchisees found"));
  }

  return res.status(200).json(new ApiResponse(200, franchisees, "Franchisee chain fetched successfully"));
});

const amountUpdate = asyncHandler(async (req, res) => {
  // Log userId
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(403).send("User not found");

    res.json({ wallet: user.bookingWallet });
  } catch (error) {
    throw new ApiError(500, "something went wrong fetching amount");
  }
});

const getFilteredTransactionHistory = asyncHandler(async (req, res) => {
  const { startDate, endDate, transactionType, userId, timeStamp } = req.query;
  // Validate userId

  const filter = { userId: new mongoose.Types.ObjectId(userId) };

  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  } else {
    // Correctly set the date range to the past 7 days
    const now = new Date();
    const pastWeek = new Date();
    pastWeek.setDate(now.getDate() - 1);

    if (timeStamp) {
      pastWeek.setDate(now.getDate() - timeStamp);
    }

    // Subtract 7 days from the current date

    filter.createdAt = {
      $gte: pastWeek,
      $lte: now,
    };
  }
  if (transactionType) {
    filter.type = transactionType;
  }
  // Find transactions that match the filter
  // Add remarks filter for "Online Payment"
  filter.remarks = "Online Payment";
  // Fetch filtered transactions
  const transactions = await Ledger.find(filter)
    .sort({ createdAt: -1 })
    .limit(50);

  // Check for missing transactionId and update in bulk
  const transactionsToUpdate = [];
  transactions.forEach((transaction) => {
    if (!transaction.transactionId) {
      transaction.transactionId = generateTransactionNumber();
      transactionsToUpdate.push(transaction);
    }
  });

  // Save all updated transactions if there are any missing transactionIds
  if (transactionsToUpdate.length > 0) {
    await Ledger.bulkWrite(
      transactionsToUpdate.map((tx) => ({
        updateOne: {
          filter: { _id: tx._id },
          update: { transactionId: tx.transactionId },
        },
      }))
    );
  }

  return res.status(200).json({ transactions });
});

const addUnit = asyncHandler(async (req, res) => {

  const { unit } = req.body;

  const unitExists = await unitdb.findOne({ unit });
  if (unitExists) {
    throw new ApiError("Unit already exists");
  }
  const newUnit = new unitdb({ unit });
  await newUnit.save();

  return res.status(201).json({ unit: newUnit.unit });
});

const getUnits = asyncHandler(async (req, res) => {
  const units = await unitdb.find().sort({ unit: 1 });

  return res.status(200).json({ units });
});

const verifyPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;
  if (pin === "3399") {
    return res.json({ success: true, message: "PIN Verified" });
  } else {
    return res.status(401).json({ success: false, message: "Incorrect PIN" });
  }
});

// Get dashboard data based on user role and tenant model
const getDashboardData = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenantId;

    // Basic stats for all roles
    const stats = {
      role: user.role,
      modelType: tenantId.modelType,
    };

    // Get user hierarchy data
    const hierarchyData = await getUserHierarchyStats(
      user._id,
      user.role,
      tenantId.modelType
    );

    // Get permissions based on role and model type
    const permissions = getPermissions(user.role, tenantId.modelType);

    // Combine all data
    const dashboardData = {
      userInfo: {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        wallet: user.bookingWallet,
      },
      tenantInfo: {
        name: tenantId.name,
        modelType: tenantId.modelType,
        code: tenantId.code,
        status: tenantId.status,
      },
      stats: hierarchyData,
      permissions,
    };

    return res.status(200).json({
      success: true,
      dashboardData,
    });
  } catch (error) {
    console.error("Dashboard data error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Helper function to get user hierarchy statistics
async function getUserHierarchyStats(userId, role, modelType) {
  const stats = {
    superFranchisees: 0,
    franchisees: 0,
    subFranchisees: 0,
    directUsers: 0,
    indirectUsers: 0,
    totalUsers: 0
  };

  const results = await User.aggregate([
    { $match: { createdBy: userId } },
    {
      $facet: {
        roleCounts: [
          { $group: { _id: "$role", count: { $sum: 1 } } }
        ],
        indirectCounts: [
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "createdBy",
              as: "indirectUsers"
            }
          },
          {
            $group: {
              _id: null,
              directCount: { $sum: 1 },
              indirectCount: { $sum: { $size: "$indirectUsers" } }
            }
          }
        ]
      }
    }
  ]);

  const facet = results[0] || {};
  (facet.roleCounts || []).forEach((item) => {
    if (item._id === "superFranchisee") stats.superFranchisees = item.count;
    if (item._id === "franchisee") stats.franchisees = item.count;
    if (item._id === "subFranchisee") stats.subFranchisees = item.count;
  });

  const indirectInfo = facet.indirectCounts?.[0] || { directCount: 0, indirectCount: 0 };
  stats.directUsers = indirectInfo.directCount;
  stats.indirectUsers = indirectInfo.indirectCount;
  stats.totalUsers = stats.directUsers + stats.indirectUsers;

  return stats;
}

// Helper function to determine user permissions based on role and model type
function getPermissions(role, modelType) {
  const permissions = {
    canCreateSuperFranchisee: false,
    canCreateFranchisee: false,
    canCreateSubFranchisee: false,
    canViewAnalytics: false,
    canManageTests: false,
    canManagePayments: false,
  };

  // Set permissions based on role
  switch (role) {
    case "admin":
      permissions.canViewAnalytics = true;
      permissions.canManageTests = true;
      permissions.canManagePayments = true;

      // Model-specific permissions for admin
      if (
        modelType === "2layer" ||
        modelType === "3layer" ||
        modelType === "4layer"
      ) {
        permissions.canCreateFranchisee = true;
      }

      if (modelType === "3layer" || modelType === "4layer") {
        permissions.canCreateSuperFranchisee = true;
      }
      break;

    case "superFranchisee":
      permissions.canViewAnalytics = true;
      permissions.canManagePayments = true;

      // Model-specific permissions for superFranchisee
      if (modelType === "3layer" || modelType === "4layer") {
        permissions.canCreateFranchisee = true;
      }

      if (modelType === "4layer") {
        permissions.canCreateSubFranchisee = true;
      }
      break;

    case "franchisee":
      permissions.canViewAnalytics = true;

      // Model-specific permissions for franchisee
      if (modelType === "4layer") {
        permissions.canCreateSubFranchisee = true;
      }
      break;

    case "subFranchisee":
      // SubFranchisee has limited permissions
      break;
  }

  return permissions;
}

const superFranchiseeUpdate = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.query;
    const sFranchisee = await User.findOne({ _id });
    // const test = await Testdb.findOne({testName: testName})

    if (!sFranchisee) {
      throw new ApiError(400, "superFranchisee not found");
    }
    res
      .status(200)
      .json(
        new ApiResponse(201, sFranchisee, "superFranchisee found suceessfully")
      );
  } catch (error) {
    throw new ApiError(
      500,
      error,
      "Something went wrong superFranchisee not found"
    );
  }
});

const getNotificationPreferences = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.userId)
    .select("email phoneNumber phoneNo emailVerified emailVerifiedAt phoneVerified phoneVerifiedAt notificationPreferences whatsappOptIn whatsappOptInAt emailNotificationEnabled smsNotificationEnabled whatsappNotificationEnabled tenantId")
    .lean();
  if (!target) return res.status(404).json({ success: false, message: "User not found" });
  return res.status(200).json({ success: true, data: target });
});

const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const { whatsappPolicy, userOptIn, emailEnabled, smsEnabled } = req.body;
  if (whatsappPolicy && !["inherit", "enabled", "disabled"].includes(whatsappPolicy)) {
    return res.status(400).json({ success: false, message: "Invalid WhatsApp policy" });
  }
  const target = await User.findById(req.params.userId);
  if (!target) return res.status(404).json({ success: false, message: "User not found" });
  const now = new Date();
  const update = {
    ...(whatsappPolicy ? { "notificationPreferences.whatsapp.adminPolicy": whatsappPolicy } : {}),
    ...(typeof userOptIn === "boolean" ? {
      "notificationPreferences.whatsapp.userOptIn": userOptIn,
      whatsappOptIn: userOptIn,
      whatsappNotificationEnabled: userOptIn,
      ...(userOptIn ? { "notificationPreferences.whatsapp.optedInAt": now, whatsappOptInAt: now } : { "notificationPreferences.whatsapp.optedOutAt": now })
    } : {}),
    ...(typeof emailEnabled === "boolean" ? { "notificationPreferences.email.enabled": emailEnabled, emailNotificationEnabled: emailEnabled } : {}),
    ...(typeof smsEnabled === "boolean" ? { "notificationPreferences.sms.enabled": smsEnabled, smsNotificationEnabled: smsEnabled } : {}),
    "notificationPreferences.whatsapp.updatedBy": req.user._id,
  };
  await User.updateOne({ _id: target._id }, { $set: update, $push: { activities: {
    activityType: "user_management",
    details: { action: "notification_preferences_updated", changedBy: req.user._id, changes: req.body },
    timestamp: now
  } } });
  return res.status(200).json({ success: true, message: "Notification preferences updated" });
});

const getNotificationDeliveryHistory = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.userId) filter.recipientUserId = req.query.userId;
  if (req.query.bookingId) filter.bookingId = req.query.bookingId;
  const deliveries = await NotificationDelivery.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  return res.status(200).json({ success: true, data: deliveries });
});

const retryNotificationDelivery = asyncHandler(async (req, res) => {
  const delivery = await NotificationDelivery.findByIdAndUpdate(req.params.deliveryId, { $set: { status: "queued", lastError: null }, $inc: { attempts: -1 } }, { new: true });
  if (!delivery) return res.status(404).json({ success: false, message: "Notification delivery not found" });
  return res.status(200).json({ success: true, data: delivery });
});

// delete admin user & tenant by super admin 
const deleteAdminAndTenant = asyncHandler(async (req, res) => {
  try {
    const { Id } = req.params;
    // console.log("adminId", Id);
    const tenantUser = await Tenant.findById(Id);
    if (!tenantUser) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    // Delete all users associated with this tenant
    await User.deleteMany({ tenantId: tenantUser._id });
    // Delete the tenant
    await Tenant.findByIdAndDelete(tenantUser._id);
    return res
      .status(200)
      .json({ message: "Tenant and associated users deleted successfully" });
  } catch (error) {
    console.error("Error deleting tenant and users:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Add amount to user's bookingWallet
const addBookingWalletAmount = async (req, res) => {
  try {
    const { amount } = req.body;

    let userId;
    if (req.user.role === 'staff') {
      userId = req.user.parentUser._id;
    } else {
      userId = req.user._id;
    }

    // const userId = req.user._id; // Assuming user ID is available in req.user
    const tenantId = req.user.tenantId._id;
    // Validation
    if (!userId || !amount || !tenantId) {
      return res.status(400).json({
        success: false,
        message: "admin details are required"
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0"
      });
    }

    // Find user and update bookingWallet
    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        tenantId: tenantId
      },
      {
        $inc: { bookingWallet: parseFloat(amount) },
        $set: { updatedAt: new Date() }
      },
      {
        new: true, // Return updated document
        runValidators: true
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const transactionNumber = generateTransactionNumber();
    // Optional: Add transaction record to bookingLedger
    const ledgerEntry = {
      transactionId: transactionNumber,
      amount: parseFloat(amount),
      type: 'credit',
      description: 'Amount added to booking wallet',
      timestamp: new Date(),
      balanceAfterTransaction: user.bookingWallet
    };

    await User.findOneAndUpdate(
      {
        _id: userId,
        tenantId: tenantId
      },
      {
        $push: { bookingLedger: ledgerEntry }
      }
    );

    // Create ledger entry for Admin
    const savedledgerEntry = await Ledger.create({
      userId,
      amount: parseFloat(amount),
      type: "credit",
      description: `Self Amount increased by Admin`,
      balanceAfterTransaction: user.bookingWallet,
      transactionId: transactionNumber,
      remarks: `Amount added to booking wallet`,
      username: `${userId}/${userId}`,
    });

    // Respond with success and updated wallet balance
    if (!savedledgerEntry) {
      return res.status(500).json({
        success: false,
        message: "Failed to create ledger entry"
      });
    }

    return res.status(200).json({
      success: true,
      message: `₹${amount} added successfully to booking wallet`,
      data: {
        userId: user._id,
        previousBalance: user.bookingWallet - parseFloat(amount),
        amountAdded: parseFloat(amount),
        currentBalance: user.bookingWallet,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Error adding amount to booking wallet:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const franchisee = asyncHandler(async (req, res) => {

  let userId;
  if (req.user.role === 'staff') {
    userId = req.user.parentUser;
  } else {
    userId = req.user._id;
  }
  const tenantId = req.user.tenantId._id;
  try {
    const franchisees = await User.find(
      {
        createdBy: userId,
        tenantId: tenantId
      }
    ).select("-password -refreshToken") // Exclude sensitive info

    if (franchisees.length === 0) {
      return res.status(404).json({ success: false, message: 'No franchisees found' });
    }

    res.status(200).json({ success: true, franchisees });
  } catch (error) {
    console.error('Error fetching franchisees:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Set overdraft permission & limit for a user (franchisee)
const setOverdraft = asyncHandler(async (req, res) => {
  try {
    const { userId, overdraftAllowed, overdraftLimit } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

    // Only allow superAdmin or admins to set overdraft (route will also be protected)
    if (!['superAdmin', 'admin', 'superFranchisee'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to set overdraft' });
    }

    const updateObj = {};
    if (typeof overdraftAllowed === 'boolean') updateObj.overdraftAllowed = overdraftAllowed;
    if (typeof overdraftLimit !== 'undefined') updateObj.overdraftLimit = Number(overdraftLimit) || 0;

    const updated = await User.findByIdAndUpdate(userId, { $set: updateObj }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'User not found' });

    // Log activity
    await updated.logActivity('user_management', { action: 'set_overdraft', by: req.user._id, overdraftAllowed: updated.overdraftAllowed, overdraftLimit: updated.overdraftLimit });

    return res.status(200).json({ success: true, message: 'Overdraft updated', user: updated });
  } catch (error) {
    console.error('Error in setOverdraft:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export {
  registerUser,
  loginUser,
  logOutUser,
  getCurrentUser,
  refreshAccessToken,
  superFranchiseeCreate,
  // New: set overdraft permission and limit for franchisees
  setOverdraft,
  moneySendToFranchisee,
  moneySendToSubFranchisee,
  moneySendToSuperFranchisee,
  amountUpdate,
  getMyFranchisees,
  toggleFranchiseeStatus,
  fetchAllFranchisee,
  fetchFranchiseeChain,
  moneyDebitFromSuperFranchisee,
  moneyDebitFromFranchisee,
  moneyDebitFromSubFranchisee,
  getFilteredTransactionHistory,
  addUnit,
  getUnits,
  verifyPin,
  superFranchiseeUpdate,
  deleteAdminAndTenant,
  getDashboardData,
  addBookingWalletAmount,
  updateBankDetails,
  getBankDetails,
  setupRazorpayAccount,
  getRazorpayAccount,
  payToAdmin,
  verifyAdminPayment,
  createWalletTopup,
  verifyWalletTopup,
  getWalletTopupHistory,
  getPlatformFinanceSummary,
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotificationDeliveryHistory,
    retryNotificationDelivery,
  franchisee
};

// ✅ Update Bank Details for Payouts
const updateBankDetails = asyncHandler(async (req, res) => {
  const { accountNumber, ifscCode, accountHolderName, bankName } = req.body;
  const userId = req.user._id;

  // Validate required fields
  if (!accountNumber || !ifscCode || !accountHolderName) {
    return res.status(400).json({
      success: false,
      message: "Account number, IFSC code, and account holder name are required"
    });
  }

  // Basic IFSC validation (Indian IFSC codes are 11 characters)
  if (ifscCode.length !== 11) {
    return res.status(400).json({
      success: false,
      message: "Invalid IFSC code format"
    });
  }

  // Basic account number validation
  if (accountNumber.length < 9 || accountNumber.length > 18) {
    return res.status(400).json({
      success: false,
      message: "Account number should be 9-18 digits"
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  // Update bank details
  user.bankDetails = {
    accountNumber,
    ifscCode: ifscCode.toUpperCase(),
    accountHolderName,
    bankName: bankName || "Unknown Bank",
    verified: false, // Will be verified during first payout attempt
    verifiedAt: null
  };

  await user.save();

  await user.logActivity("bank_details_updated", {
    accountNumber: accountNumber.slice(-4), // Log only last 4 digits for security
    ifscCode,
    bankName
  });

  res.status(200).json({
    success: true,
    message: "Bank details updated successfully",
    data: {
      accountNumber: `****${accountNumber.slice(-4)}`, // Mask account number
      ifscCode,
      accountHolderName,
      bankName,
      verified: false
    }
  });
});

// ✅ Get Bank Details
const getBankDetails = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select('bankDetails');
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  res.status(200).json({
    success: true,
    data: user.bankDetails || {}
  });
});

// ✅ Setup Razorpay Account for Admin
const setupRazorpayAccount = asyncHandler(async (req, res) => {
  const { razorpayKeyId, razorpayKeySecret, accountNumber } = req.body;
  const userId = req.user._id;

  // Only admin can setup Razorpay account
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: "Only admins can setup Razorpay accounts"
    });
  }

  // Validate required fields
  if (!razorpayKeyId || !razorpayKeySecret || !accountNumber) {
    return res.status(400).json({
      success: false,
      message: "Razorpay Key ID, Key Secret, and Account Number are required"
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  // Test Razorpay connection
  try {
    const testRazorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    });

    // Try to create a test order to verify credentials
    await testRazorpay.orders.create({
      amount: 100, // ₹1 test
      currency: "INR",
      receipt: "test_connection"
    });

  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid Razorpay credentials. Please check your keys.",
      error: error.message
    });
  }

  // Update Razorpay account details
  user.razorpayAccount = {
    razorpayKeyId,
    razorpayKeySecret,
    accountNumber,
    isActive: true,
    verified: true,
    verifiedAt: new Date()
  };

  await user.save();

  await user.logActivity("razorpay_account_setup", {
    accountNumber,
    verifiedAt: new Date()
  });

  res.status(200).json({
    success: true,
    message: "Razorpay account setup successfully",
    data: {
      accountNumber,
      isActive: true,
      verified: true,
      verifiedAt: new Date()
    }
  });
});

// ✅ Get Razorpay Account Details
const getRazorpayAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select('razorpayAccount');
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  res.status(200).json({
    success: true,
    data: user.razorpayAccount || {}
  });
});

// ✅ Franchisee Payment to Admin (Real Money via Razorpay)
const payToAdmin = asyncHandler(async (req, res) => {
  const { adminId, amount, paymentMethod = "online" } = req.body;
  const franchiseeId = req.user._id;

  // Validate input
  if (!adminId || !amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid admin ID and amount are required"
    });
  }

  // Check global payment gateway setting
  let settings = await SystemSetting.findOne();
  if (settings && !settings.isPaymentGatewayEnabled && paymentMethod !== "wallet") {
      return res.status(400).json({
          success: false,
          message: "Online payments are currently disabled. Please use manual payment methods."
      });
  }

  const franchisee = await User.findById(franchiseeId);
  const admin = await User.findById(adminId);

  if (!franchisee || !admin) {
    return res.status(404).json({
      success: false,
      message: "Franchisee or Admin not found"
    });
  }

  // Check if admin has Razorpay account OR virtual account
  const hasRazorpayAccount = admin.razorpayAccount && admin.razorpayAccount.isActive;
  const hasVirtualAccount = admin.virtualAccount && admin.virtualAccount.isActive;

  if (!hasRazorpayAccount && !hasVirtualAccount) {
    return res.status(400).json({
      success: false,
      message: "Admin has not setup Razorpay account or virtual account for receiving payments"
    });
  }

  // Check franchisee balance (if paying from wallet)
  if (paymentMethod === "wallet" && franchisee.bookingWallet < amount) {
    return res.status(400).json({
      success: false,
      message: "Insufficient wallet balance"
    });
  }

  try {
    let razorpayInstance;
    let order;

    // Use admin's Razorpay account if available, otherwise use superadmin's for virtual account
    if (hasRazorpayAccount) {
      razorpayInstance = new Razorpay({
        key_id: admin.razorpayAccount.razorpayKeyId,
        key_secret: admin.razorpayAccount.razorpayKeySecret
      });
    } else {
      // Use superadmin's Razorpay for virtual account payments
      razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
    }

    // Create Razorpay order
    order = await razorpayInstance.orders.create({
      amount: amount * 100, // Convert to paise
      currency: "INR",
      receipt: `PAY_ADMIN_${franchiseeId}_${Date.now()}`,
      notes: {
        franchiseeId: franchiseeId,
        adminId: adminId,
        paymentType: hasVirtualAccount ? "virtual_account" : "direct_payment",
        virtualAccountId: hasVirtualAccount ? admin.virtualAccount.virtualAccountId : null
      }
    });

    // If payment method is wallet, deduct immediately
    if (paymentMethod === "wallet") {
      franchisee.bookingWallet -= amount;
      admin.bookingWallet += amount;

      await franchisee.save();
      await admin.save();

      // Create ledger entries
      const transactionId = `WALLET_PAY_${Date.now()}`;

      await Ledger.create([
        {
          userId: franchisee._id,
          amount: amount,
          type: "debit",
          description: `Payment to Admin ${admin.fullName || admin.username}`,
          balanceAfterTransaction: franchisee.bookingWallet,
          transactionId: transactionId,
          remarks: "Wallet Payment to Admin",
          username: `${franchisee.username}/${admin.username}`,
        },
        {
          userId: admin._id,
          amount: amount,
          type: "credit",
          description: `Received from Franchisee ${franchisee.fullName || franchisee.username}`,
          balanceAfterTransaction: admin.bookingWallet,
          transactionId: transactionId,
          remarks: "Wallet Payment from Franchisee",
          username: `${admin.username}/${franchisee.username}`,
        }
      ]);

      await franchisee.logActivity("payment_to_admin", {
        adminId: admin._id,
        adminName: admin.fullName || admin.username,
        amount: amount,
        paymentMethod: "wallet",
        transactionId: transactionId
      });

      await admin.logActivity("payment_from_franchisee", {
        franchiseeId: franchisee._id,
        franchiseeName: franchisee.fullName || franchisee.username,
        amount: amount,
        paymentMethod: "wallet",
        transactionId: transactionId
      });
    }

    res.status(200).json({
      success: true,
      message: paymentMethod === "wallet" ? "Payment completed successfully" : "Payment order created",
      data: {
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        razorpayKeyId: hasRazorpayAccount ? admin.razorpayAccount.razorpayKeyId : process.env.RAZORPAY_KEY_ID,
        adminName: admin.fullName || admin.username,
        franchiseeName: franchisee.fullName || franchisee.username,
        paymentMethod: paymentMethod,
        paymentType: hasVirtualAccount ? "virtual_account" : "direct_razorpay",
        ...(hasVirtualAccount && {
          virtualAccount: {
            accountNumber: admin.virtualAccount.accountNumber,
            ifscCode: admin.virtualAccount.ifscCode
          }
        }),
        ...(paymentMethod === "wallet" && {
          franchiseeWallet: franchisee.bookingWallet,
          adminWallet: admin.bookingWallet
        })
      }
    });

  } catch (error) {
    console.error("Error creating payment to admin:", error);
    res.status(500).json({
      success: false,
      message: "Error processing payment",
      error: error.message
    });
  }
});

// ✅ Verify Franchisee Payment to Admin
const verifyAdminPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, adminId } = req.body;
  const franchiseeId = req.user._id;

  const franchisee = await User.findById(franchiseeId);
  const admin = await User.findById(adminId);

  if (!franchisee || !admin) {
    return res.status(404).json({
      success: false,
      message: "Franchisee or Admin not found"
    });
  }

  if (!admin.razorpayAccount || !admin.razorpayAccount.isActive) {
    return res.status(400).json({
      success: false,
      message: "Admin Razorpay account not configured"
    });
  }

  try {
    // Verify payment signature with admin's secret
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", admin.razorpayAccount.razorpayKeySecret)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed"
      });
    }

    // Get payment details
    const adminRazorpay = new Razorpay({
      key_id: admin.razorpayAccount.razorpayKeyId,
      key_secret: admin.razorpayAccount.razorpayKeySecret
    });

    const payment = await adminRazorpay.payments.fetch(razorpay_payment_id);
    const order = await adminRazorpay.orders.fetch(razorpay_order_id);

    const amount = order.amount / 100; // Convert from paise

    // Credit amount to admin's booking wallet
    admin.bookingWallet += amount;
    await admin.save();

    // Create ledger entry for admin
    const transactionId = `RAZORPAY_${razorpay_payment_id}`;

    await Ledger.create({
      userId: admin._id,
      amount: amount,
      type: "credit",
      description: `Payment received from Franchisee ${franchisee.fullName || franchisee.username}`,
      balanceAfterTransaction: admin.bookingWallet,
      transactionId: transactionId,
      remarks: "Razorpay Payment from Franchisee",
      username: `${admin.username}/${franchisee.username}`,
      paymentMethod: "razorpay",
      razorpayPaymentId: razorpay_payment_id
    });

    // Log activities
    await admin.logActivity("razorpay_payment_received", {
      franchiseeId: franchisee._id,
      franchiseeName: franchisee.fullName || franchisee.username,
      amount: amount,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id
    });

    await franchisee.logActivity("razorpay_payment_sent", {
      adminId: admin._id,
      adminName: admin.fullName || admin.username,
      amount: amount,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id
    });

    res.status(200).json({
      success: true,
      message: "Payment verified and processed successfully",
      data: {
        amount: amount,
        adminWallet: admin.bookingWallet,
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id
      }
    });

  } catch (error) {
    console.error("Error verifying admin payment:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying payment",
      error: error.message
    });
  }
});

// ✅ Create Wallet Top-up Order for Franchisee (Using Global Razorpay Keys) - PRODUCTION GRADE
const createWalletTopup = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const userId = req.user._id;
  const tenantId = req.user.tenantId._id;

  // ✅ VALIDATION 1: Razorpay Configuration
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("❌ Razorpay configuration missing on server");
    return res.status(500).json({
      success: false,
      message: "Payment gateway not configured. Contact admin."
    });
  }

  // ✅ VALIDATION 2: Amount Validation
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 100 || numericAmount > 100000) {
    return res.status(400).json({
      success: false,
      message: "Invalid amount. Minimum ₹100, Maximum ₹100,000 allowed."
    });
  }

  // ✅ VALIDATION 3: User exists and active
  const user = await User.findById(userId).select('_id tenantId role');
  if (!user || !user.tenantId) {
    return res.status(404).json({
      success: false,
      message: "User account not found"
    });
  }

  try {
    console.log("📱 Wallet top-up order initiated:", { userId: userId.toString(), amount: numericAmount });

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    // ✅ Generate unique receipt (max 40 chars)
    const timestamp = Date.now().toString().slice(-10);
    const userIdShort = userId.toString().slice(-8);
    const receipt = `wt_${userIdShort}_${timestamp}`.substring(0, 40);

    const options = {
      amount: numericAmount * 100, // amount in paise
      currency: "INR",
      receipt: receipt,
      notes: {
        userId: userId.toString(),
        tenantId: tenantId.toString(),
        type: "wallet_topup",
        timestamp: new Date().toISOString()
      }
    };

    const order = await razorpay.orders.create(options);

    // ✅ Log success without sensitive data
    console.log("✅ Order created:", { orderId: order.id, amount: numericAmount });

    res.status(200).json({
      success: true,
      message: "Order created successfully",
      data: {
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
      }
    });

  } catch (error) {
    // ✅ Don't expose internal Razorpay errors to frontend
    console.error("❌ Order creation failed:", {
      userId: userId.toString(),
      errorMessage: error.message,
      errorCode: error.code
    });

    // Return generic error to user
    res.status(500).json({
      success: false,
      message: "Failed to create payment order. Please try again.",
      code: "ORDER_CREATION_FAILED"
    });
  }
});

// ✅ Verify Wallet Top-up Payment (Using Global Razorpay Keys) - PRODUCTION GRADE
const verifyWalletTopup = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
  const userId = req.user._id;
  const tenantId = req.user.tenantId._id;

  // ✅ VALIDATION 1: Input Sanitation
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: "Missing payment verification details"
    });
  }

  if (typeof razorpay_signature !== 'string' || razorpay_signature.length !== 64) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment signature format"
    });
  }

  // ✅ VALIDATION 2: Amount Validation
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 100 || numericAmount > 100000) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment amount"
    });
  }

  // ✅ VALIDATION 3: Razorpay Configuration
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("❌ Razorpay configuration missing");
    return res.status(500).json({
      success: false,
      message: "Payment gateway configuration error"
    });
  }

  // ✅ VALIDATION 4: Check if payment already processed (Idempotency)
  const existingLedger = await Ledger.findOne({
    razorpayPaymentId: razorpay_payment_id,
    userId: userId,
    type: "credit"
  });

  if (existingLedger) {
    console.warn("⚠️ Duplicate payment attempt detected:", { razorpay_payment_id, userId: userId.toString() });
    return res.status(400).json({
      success: false,
      message: "Payment already processed",
      code: "DUPLICATE_PAYMENT"
    });
  }

  // ✅ VALIDATION 5: User and Admin verification
  const [franchisee, admin] = await Promise.all([
    User.findById(userId).select('_id tenantId bookingWallet username fullName role'),
    User.findOne({ tenantId: tenantId, role: 'admin' }).select('_id commissionWallet username')
  ]);

  if (!franchisee) {
    return res.status(404).json({
      success: false,
      message: "User account not found"
    });
  }

  if (!admin) {
    console.error("❌ Admin not found for tenant:", tenantId.toString());
    return res.status(500).json({
      success: false,
      message: "Franchise admin not found"
    });
  }

  try {
    console.log("🔍 Verifying payment:", { orderId: razorpay_order_id, paymentId: razorpay_payment_id });

    // ✅ VALIDATION 6: Verify Payment Signature (Critical Security Step)
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    // Use constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(razorpay_signature), Buffer.from(expectedSign))) {
      console.warn("❌ Signature mismatch for payment:", { razorpay_payment_id });
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
        code: "SIGNATURE_MISMATCH"
      });
    }

    // ✅ VALIDATION 7: Verify with Razorpay API
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const [payment, order] = await Promise.all([
      razorpay.payments.fetch(razorpay_payment_id),
      razorpay.orders.fetch(razorpay_order_id)
    ]);

    // ✅ VALIDATION 8: Check payment status and amount
    const razorpayAmount = order.amount / 100; // Convert from paise

    if (payment.status !== 'captured') {
      console.warn("❌ Payment not captured:", { status: payment.status, razorpay_payment_id });
      return res.status(400).json({
        success: false,
        message: "Payment not completed successfully",
        code: "PAYMENT_NOT_CAPTURED"
      });
    }

    // Allow 1 paise difference due to float precision
    if (Math.abs(razorpayAmount - numericAmount) > 0.01) {
      console.error("❌ Amount mismatch:", { requested: numericAmount, received: razorpayAmount, razorpay_payment_id });
      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch",
        code: "AMOUNT_MISMATCH"
      });
    }

    console.log("✅ Payment verified from Razorpay:", { amount: razorpayAmount, status: payment.status });

    // ✅ STEP 1: Update Franchisee's bookingWallet
    const updatedFranchisee = await User.findByIdAndUpdate(
      franchisee._id,
      {
        $inc: { bookingWallet: razorpayAmount },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );

    // ✅ STEP 2: Update Admin's commissionWallet
    const updatedAdmin = await User.findByIdAndUpdate(
      admin._id,
      {
        $inc: { commissionWallet: razorpayAmount },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );

    // ✅ STEP 3: Generate Transaction ID
    const transactionId = `WALLET_TOPUP_${razorpay_payment_id}`;

    // ✅ STEP 4: Create Ledger entries (atomic operation)
    await Promise.all([
      // Franchisee ledger entry
      Ledger.create({
        userId: franchisee._id,
        amount: razorpayAmount,
        type: "credit",
        description: "Wallet Top-up via Razorpay",
        balanceAfterTransaction: updatedFranchisee.bookingWallet,
        transactionId: transactionId,
        remarks: "Online payment - credited to bookingWallet",
        username: franchisee.username,
        paymentMethod: "razorpay",
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        walletType: "bookingWallet",
        role: franchisee.role,
        receivedFrom: "Razorpay"
      }),
      // Admin ledger entry
      Ledger.create({
        userId: admin._id,
        amount: razorpayAmount,
        type: "credit",
        description: `Wallet Top-up received from ${franchisee.fullName || franchisee.username}`,
        balanceAfterTransaction: updatedAdmin.commissionWallet,
        transactionId: transactionId,
        remarks: "Online payment received - credited to commissionWallet",
        username: admin.username,
        paymentMethod: "razorpay",
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        walletType: "commissionWallet",
        role: admin.role,
        receivedFrom: franchisee.fullName || franchisee.username
      }),
      // Add to user's bookingLedger array
      User.findByIdAndUpdate(
        franchisee._id,
        {
          $push: {
            bookingLedger: {
              transactionId: transactionId,
              amount: razorpayAmount,
              type: 'credit',
              description: 'Wallet top-up via Razorpay',
              timestamp: new Date(),
              balanceAfterTransaction: updatedFranchisee.bookingWallet
            }
          }
        }
      )
    ]);

    // ✅ STEP 5: Log activities
    await Promise.all([
      franchisee.logActivity("wallet_topup_success", {
        amount: razorpayAmount,
        razorpayPaymentId: razorpay_payment_id,
        walletBalance: updatedFranchisee.bookingWallet
      }),
      admin.logActivity("wallet_topup_received", {
        franchiseeId: franchisee._id,
        franchiseeName: franchisee.fullName || franchisee.username,
        amount: razorpayAmount,
        commissionWallet: updatedAdmin.commissionWallet
      })
    ]);

    console.log("✅ Wallet top-up completed successfully:", {
      userId: userId.toString(),
      amount: razorpayAmount,
      newBalance: updatedFranchisee.bookingWallet
    });

    res.status(200).json({
      success: true,
      message: "Payment verified and wallet updated successfully",
      data: {
        transactionId: transactionId,
        amount: razorpayAmount,
        newBalance: updatedFranchisee.bookingWallet,
        razorpayPaymentId: razorpay_payment_id
      }
    });

  } catch (error) {
    // ✅ Generic error response (don't expose sensitive info)
    console.error("❌ Payment verification error:", {
      userId: userId.toString(),
      razorpayPaymentId: razorpay_payment_id,
      errorMessage: error.message,
      errorCode: error.code
    });

    res.status(500).json({
      success: false,
      message: "Payment verification failed. Please contact support if amount was deducted.",
      code: "VERIFICATION_ERROR"
    });
  }
});

const getWalletTopupHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { startDate, endDate, search = "", page = 1, limit = 50 } = req.query;
  const safeLimit = Math.min(Number(limit) || 50, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * safeLimit;

  const query = {
    userId,
    $or: [
      { paymentMethod: "razorpay" },
      { walletType: { $in: ["bookingWallet", "commissionWallet"] } },
      { remarks: /Online payment/i },
      { description: /Wallet Top-up/i }
    ]
  };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  if (search) {
    const term = new RegExp(String(search).trim(), "i");
    query.$and = [{
      $or: [
        { transactionId: term },
        { razorpayPaymentId: term },
        { description: term },
        { remarks: term },
        { receivedFrom: term }
      ]
    }];
  }

  const [transactions, total, user] = await Promise.all([
    Ledger.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    Ledger.countDocuments(query),
    User.findById(userId).select("bookingWallet commissionWallet role username fullName").lean()
  ]);

  res.status(200).json({
    success: true,
    data: {
      transactions,
      total,
      balances: {
        bookingWallet: user?.bookingWallet || 0,
        commissionWallet: user?.commissionWallet || 0,
      },
      user: {
        role: user?.role,
        username: user?.username,
        fullName: user?.fullName
      }
    }
  });
});

const getPlatformFinanceSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    subscriptionRevenue,
    monthlySubscriptionRevenue,
    bookingWalletRevenue,
    monthlyBookingWalletRevenue,
    referralCommission,
    pendingWithdrawals,
    approvedWithdrawals,
    activeAdmins,
    topAdmins
  ] = await Promise.all([
    Ledger.aggregate([
      { $match: { type: "credit", remarks: "Razorpay Subscription Renewal" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Ledger.aggregate([
      { $match: { type: "credit", remarks: "Razorpay Subscription Renewal", createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Ledger.aggregate([
      { $match: { type: "credit", walletType: "commissionWallet", remarks: /Online payment received/i } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Ledger.aggregate([
      { $match: { type: "credit", walletType: "commissionWallet", remarks: /Online payment received/i, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Ledger.aggregate([
      { $match: { type: "credit", remarks: "Referral Commission" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    User.aggregate([
      { $unwind: "$withdrawalRequests" },
      { $match: { "withdrawalRequests.status": "pending" } },
      { $group: { _id: null, total: { $sum: "$withdrawalRequests.amount" }, count: { $sum: 1 } } }
    ]),
    User.aggregate([
      { $unwind: "$withdrawalRequests" },
      { $match: { "withdrawalRequests.status": { $in: ["approved", "processed"] } } },
      { $group: { _id: null, total: { $sum: "$withdrawalRequests.amount" }, count: { $sum: 1 } } }
    ]),
    User.countDocuments({ role: "admin", isActive: true }),
    Ledger.aggregate([
      { $match: { type: "credit", walletType: "commissionWallet", remarks: /Online payment received/i } },
      { $group: { _id: "$userId", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { _id: 0, userId: "$_id", name: "$user.fullName", username: "$user.username", total: 1, count: 1 } }
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      subscriptionRevenue: subscriptionRevenue[0]?.total || 0,
      monthlySubscriptionRevenue: monthlySubscriptionRevenue[0]?.total || 0,
      bookingWalletRevenue: bookingWalletRevenue[0]?.total || 0,
      monthlyBookingWalletRevenue: monthlyBookingWalletRevenue[0]?.total || 0,
      referralCommission: referralCommission[0]?.total || 0,
      pendingWithdrawalAmount: pendingWithdrawals[0]?.total || 0,
      pendingWithdrawalCount: pendingWithdrawals[0]?.count || 0,
      approvedWithdrawalAmount: approvedWithdrawals[0]?.total || 0,
      approvedWithdrawalCount: approvedWithdrawals[0]?.count || 0,
      activeAdmins,
      topAdmins
    }
  });
});
