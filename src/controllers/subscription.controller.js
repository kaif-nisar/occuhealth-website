// controllers/subscriptionController.js
import { User } from "../models/user.model.js";
import { SuperAdmin } from "../models/superAdmin.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import { Tenant } from "../models/tenant.model.js";
import { Ledger } from "../models/ledger.model.js";

// Initialize Razorpay
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });
// subscription.controller.js

// Check if RAZORPAY_KEY_ID is present
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {

    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
} else {
    console.warn("⚠️ Razorpay keys not found, using mock Razorpay object");

    razorpay = {
      contacts: {
        create: async (options) => {
          console.log("🔧 Mock contact created with options:", options);
          return {
            id: "cont_mock_123456",
            ...options
          };
        }
      },
      fundAccounts: {
        create: async (options) => {
          console.log("🔧 Mock fund account created with options:", options);
          return {
            id: "fa_mock_123456",
            ...options
          };
        }
      },
      payouts: {
        create: async (options) => {
          console.log("🔧 Mock payout created with options:", options);
          return {
            id: "pout_mock_123456",
            status: "queued",
            ...options
          };
        }
      },
        subscriptions: {
            create: async (options) => {
                console.log("🔧 Mock subscription created with options:", options);
                return {
                    id: "sub_mock_123456",
                    status: "created",
                    ...options
                };
            }
        }
    };
}

// Create subscription payment order
export const createSubscriptionOrder = async (req, res) => {
  try {
    const { amount, currency = "INR", durationMonths = 1 } = req.body;
    const userId = req.user._id;
    const numericAmount = Number(amount);
    const numericDurationMonths = Number(durationMonths);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }

    if (!Number.isFinite(numericDurationMonths) || numericDurationMonths <= 0) {
      return res.status(400).json({ success: false, message: "Valid duration is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(numericAmount * 100), // Convert to paisa
      currency: currency,
      receipt: `sub_${userId.toString().substring(0, 10)}_${Date.now().toString().substring(0, 10)}`,
      notes: {
        userId: userId.toString(),
        type: "subscription_renewal",
        durationMonths: String(Math.floor(numericDurationMonths)),
        amount: String(numericAmount)
      }
    });

    res.status(200).json({
      success: true,
      order: order,
      user: {
        name: user.fullName,
        email: user.email,
        phone: user.phoneNo
      }
    });
  } catch (error) {
    console.error("Error creating subscription order:", error);
    res.status(500).json({ message: "Error creating payment order", error: error.message });
  }
};

// Verify subscription payment
export const verifySubscriptionPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, durationMonths = 1 } = req.body;
    const userId = req.user._id;

    // Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Get payment details
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const order = await razorpay.orders.fetch(razorpay_order_id);

    // Find user and renew subscription
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const alreadyRenewed = user.subscription?.renewalHistory?.some(
      (entry) => entry.transactionId === razorpay_payment_id
    );
    if (alreadyRenewed) {
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        subscription: user.subscription
      });
    }

    // Editor/TS may not infer mongoose instance methods on the returned Document type.
    // Cast to any for the method call to avoid type-checker warnings while keeping runtime behavior.
    /** @type {any} */
    const userAny = user;

    // Renew subscription
    await userAny.renewSubscription({
      amount: payment.amount / 100, // Convert from paisa
      paymentMethod: "razorpay",
      transactionId: razorpay_payment_id,
      durationMonths: Number(durationMonths),
      monthlyAmount: Number(durationMonths) > 0 ? (payment.amount / 100) / Number(durationMonths) : payment.amount / 100
    });

    const superAdmin = req.user.createdBy || req.user.parentUser || null;
    const superAdminId = superAdmin?._id || superAdmin;
    if (superAdminId) {
      const existingLedger = await Ledger.findOne({ transactionId: razorpay_payment_id });
      if (!existingLedger) {
        await Ledger.create({
          userId: superAdminId,
          username: superAdmin?.username || "superAdmin",
          role: superAdmin?.role || "superAdmin",
          transactionId: razorpay_payment_id,
          type: "credit",
          amount: payment.amount / 100,
          description: `Razorpay subscription renewal from ${user.fullName || user.username}`,
          remarks: "Razorpay Subscription Renewal",
          receivedFrom: user.fullName || user.username,
          createdAt: new Date(),
        });
      }

      await SuperAdmin.findByIdAndUpdate(superAdminId, {
        $push: {
          activities: {
            activityType: "payment",
            details: {
              amount: payment.amount / 100,
              fromUser: user.fullName || user.username,
              userId: user._id,
              paymentMethod: "razorpay",
              transactionId: razorpay_payment_id,
              durationMonths: Number(durationMonths)
            },
            timestamp: new Date()
          }
        }
      });
    }

    res.status(200).json({
      success: true,
      message: "Subscription renewed successfully",
      subscription: user.subscription
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Error verifying payment", error: error.message });
  }
};

// Renew subscription with commission
export const renewWithCommission = async (req, res) => {
  try {
    const { totalAmount, useCommission = true } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let commissionUsed = 0;
    let remainingAmount = totalAmount;

    if (useCommission && user.commissionWallet > 0) {
      const result = await user.renewWithCommission(totalAmount);
      commissionUsed = result.commissionUsed;
      remainingAmount = result.remainingAmount;
    }

    if (remainingAmount > 0) {
      // Create Razorpay order for remaining amount
      const order = await razorpay.orders.create({
        amount: remainingAmount * 100,
        currency: "INR",
        receipt: `partial_${userId.toString().substring(0, 8)}_${Date.now().toString().substring(0, 8)}`,
        notes: {
          userId: userId.toString(),
          type: "partial_subscription_renewal",
          commissionUsed: commissionUsed
        }
      });

      res.status(200).json({
        success: true,
        order: order,
        commissionUsed: commissionUsed,
        remainingAmount: remainingAmount,
        message: `₹${commissionUsed} commission applied. Pay remaining ₹${remainingAmount}`
      });
    } else {
      // Full amount covered by commission
      // Cast to any so the editor/TS server recognizes the instance method
      /** @type {any} */
      const userAny = user;

      await userAny.renewSubscription({
        amount: totalAmount,
        paymentMethod: "commission",
        transactionId: `COMM_${Date.now()}`
      });

      res.status(200).json({
        success: true,
        message: "Subscription renewed successfully using commission",
        commissionUsed: commissionUsed,
        subscription: user.subscription
      });
    }
  } catch (error) {
    console.error("Error renewing with commission:", error);
    res.status(500).json({ message: "Error processing renewal", error: error.message });
  }
};

// Get subscription status
export const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('subscription commissionWallet bookingWallet');
    const tenantId = req.user.tenantId?._id || req.user.tenantId;
    const tenant = tenantId ? await Tenant.findById(tenantId).select('subscriptionPlan') : null;

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const subscription = tenant?.subscriptionPlan || user.subscription;
    const endDate = subscription?.endDate ? new Date(subscription.endDate) : null;
    const isExpired = endDate ? endDate < new Date() : false;
    const isExpiringSoon = endDate
      ? endDate <= new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      : false;

    res.status(200).json({
      success: true,
      subscription,
      commissionWallet: user.commissionWallet,
      bookingWallet: user.bookingWallet,
      isExpired,
      isExpiringSoon,
      source: tenant ? "tenant" : "user"
    });
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    res.status(500).json({ message: "Error fetching subscription status", error: error.message });
  }
};

// Request withdrawal
export const requestWithdrawal = async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;
    const userId = req.user._id;
    const numericAmount = Number(amount);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!Number.isFinite(numericAmount) || numericAmount < 100) {
      return res.status(400).json({ message: "Minimum withdrawal amount is Rs.100" });
    }

    if (numericAmount > user.commissionWallet) {
      return res.status(400).json({ message: "Insufficient commission balance" });
    }

    if (false && amount < 100) {
      return res.status(400).json({ message: "Minimum withdrawal amount is ₹100" });
    }

    // If no bank details provided in request, method will use saved bank details
    const requestResult = await user.requestWithdrawal(numericAmount, bankDetails);

    res.status(200).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      requestId: requestResult.requestId,
      commissionWallet: user.commissionWallet
    });
  } catch (error) {
    console.error("Error requesting withdrawal:", error);
    res.status(500).json({ message: "Error requesting withdrawal", error: error.message });
  }
};

// Get withdrawal history
export const getWithdrawalHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('withdrawalRequests commissionWallet');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      withdrawalRequests: user.withdrawalRequests,
      commissionWallet: user.commissionWallet
    });
  } catch (error) {
    console.error("Error fetching withdrawal history:", error);
    res.status(500).json({ message: "Error fetching withdrawal history", error: error.message });
  }
};

// Get referral dashboard
export const getReferralDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId)
      .select('referral commissionWallet')
      .populate('referral.referredUsers.userId', 'fullName email createdAt subscription');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      referralCode: user.referral.referralCode,
      totalReferrals: user.referral.totalReferrals,
      totalCommissionEarned: user.referral.totalCommissionEarned,
      commissionWallet: user.commissionWallet,
      referredUsers: user.referral.referredUsers
    });
  } catch (error) {
    console.error("Error fetching referral dashboard:", error);
    res.status(500).json({ message: "Error fetching referral dashboard", error: error.message });
  }
};

// Register with referral code
export const registerWithReferral = async (req, res) => {
  try {
    const { referralCode, ...userData } = req.body;

    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ 'referral.referralCode': referralCode });
      if (!referrer) {
        return res.status(400).json({ message: "Invalid referral code" });
      }
    }

    // Create new user
    const newUser = new User({
      ...userData,
      'referral.referredBy': referrer ? referrer._id : null
    });

    await newUser.save();

    // If referred, update referrer's data
    if (referrer) {
      referrer.referral.referredUsers.push({
        userId: newUser._id,
        joinedAt: new Date()
      });
      referrer.referral.totalReferrals += 1;
      
      await referrer.logActivity("new_referral", {
        referredUser: newUser.fullName,
        referredUserEmail: newUser.email
      });
      
      await referrer.save();
    }

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        referralCode: newUser.referral.referralCode
      }
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Error registering user", error: error.message });
  }
};

// Super Admin: Process withdrawal request
export const processWithdrawalRequest = async (req, res) => {
  try {
    const { userId, requestId, action, rejectionReason } = req.body;
    const superAdminId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const withdrawalRequest = user.withdrawalRequests.find(req => req.requestId === requestId);
    if (!withdrawalRequest) {
      return res.status(404).json({ message: "Withdrawal request not found" });
    }

    if (withdrawalRequest.status !== "pending") {
      return res.status(400).json({ message: "Request already processed" });
    }

    if (action === "approve") {
      if (withdrawalRequest.amount > user.commissionWallet) {
        return res.status(400).json({ message: "Insufficient commission balance at approval time" });
      }

      withdrawalRequest.status = "approved";
      withdrawalRequest.processedAt = new Date();
      withdrawalRequest.processedBy = superAdminId;

      // ✅ Fraud Prevention Checks
      const recentWithdrawals = user.withdrawalRequests.filter(req =>
        req.status === "approved" &&
        req.processedAt &&
        (new Date() - new Date(req.processedAt)) < (24 * 60 * 60 * 1000) // Last 24 hours
      );

      const totalRecentAmount = recentWithdrawals.reduce((sum, req) => sum + req.amount, 0);
      const maxDailyLimit = 50000; // ₹50,000 daily limit

      if (totalRecentAmount + withdrawalRequest.amount > maxDailyLimit) {
        return res.status(400).json({
          message: "Daily withdrawal limit exceeded. Please try again tomorrow."
        });
      }

      // ✅ Validate Bank Details
      if (!withdrawalRequest.bankDetails ||
          !withdrawalRequest.bankDetails.accountNumber ||
          !withdrawalRequest.bankDetails.ifscCode ||
          !withdrawalRequest.bankDetails.accountHolderName) {
        return res.status(400).json({
          message: "Complete bank details required for payout"
        });
      }

      // ✅ Deduct from commission wallet FIRST
      user.commissionWallet -= withdrawalRequest.amount;

      // ✅ Add to commission ledger
      user.commissionLedger.push({
        transactionId: `WD_${requestId}`,
        type: "withdrawal",
        amount: withdrawalRequest.amount,
        description: `Withdrawal processed - ${requestId}`,
        balanceAfterTransaction: user.commissionWallet
      });

      await Ledger.create({
        userId: user._id,
        username: user.username,
        role: user.role,
        transactionId: `WD_${requestId}`,
        type: "debit",
        amount: withdrawalRequest.amount,
        description: `Withdrawal approved - ${requestId}`,
        remarks: "Wallet Withdrawal",
        walletType: "commissionWallet",
        balanceAfterTransaction: user.commissionWallet,
        createdAt: new Date()
      });

      // ✅ Attempt Real Payout
      try {
        const payoutResult = await initiateRazorpayPayout({
          amount: withdrawalRequest.amount * 100, // Razorpay expects paise
          accountNumber: withdrawalRequest.bankDetails.accountNumber,
          ifscCode: withdrawalRequest.bankDetails.ifscCode,
          accountHolderName: withdrawalRequest.bankDetails.accountHolderName,
          bankName: withdrawalRequest.bankDetails.bankName,
          userId: userId,
          requestId: requestId
        });

        const isManualPayout = payoutResult.mode === "manual" || payoutResult.status === "manual_pending";

        withdrawalRequest.payoutStatus = isManualPayout ? "pending" : "completed";
        withdrawalRequest.status = isManualPayout ? "approved" : "processed";
        withdrawalRequest.payoutReference = payoutResult.payoutId;
        withdrawalRequest.payoutMode = isManualPayout ? "manual" : "razorpay_payout";

        await user.logActivity("withdrawal_processed", {
          requestId: requestId,
          amount: withdrawalRequest.amount,
          processedBy: superAdminId,
          payoutReference: payoutResult.payoutId,
          payoutMode: withdrawalRequest.payoutMode
        });

      } catch (payoutError) {
        console.error("Payout failed:", payoutError);

        // ❌ Payout failed - mark as failed but keep approval
        withdrawalRequest.payoutStatus = "failed";
        withdrawalRequest.payoutMode = "razorpay_payout";

        // 🔄 Refund amount back to wallet
        user.commissionWallet += withdrawalRequest.amount;
        user.commissionLedger.push({
          transactionId: `WD_REFUND_${requestId}`,
          type: "credit",
          amount: withdrawalRequest.amount,
          description: `Payout failed - amount refunded - ${requestId}`,
          balanceAfterTransaction: user.commissionWallet
        });

        await user.logActivity("withdrawal_failed", {
          requestId: requestId,
          amount: withdrawalRequest.amount,
          error: payoutError.message,
          processedBy: superAdminId
        });

        await user.save();

        return res.status(200).json({
          success: true,
          message: "Withdrawal approved but payout failed. Amount refunded to wallet.",
          withdrawalRequest: withdrawalRequest,
          payoutError: payoutError.message
        });
      }

    } else if (action === "reject") {
      withdrawalRequest.status = "rejected";
      withdrawalRequest.processedAt = new Date();
      withdrawalRequest.processedBy = superAdminId;
      withdrawalRequest.rejectionReason = rejectionReason;

      await user.logActivity("withdrawal_rejected", {
        requestId: requestId,
        amount: withdrawalRequest.amount,
        reason: rejectionReason,
        processedBy: superAdminId
      });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: `Withdrawal request ${action}ed successfully`,
      withdrawalRequest: withdrawalRequest
    });
  } catch (error) {
    console.error("Error processing withdrawal request:", error);
    res.status(500).json({ message: "Error processing withdrawal request", error: error.message });
  }
};

// Super Admin: Get all withdrawal requests
export const getAllWithdrawalRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const matchCondition = {};
    if (status) {
      matchCondition["withdrawalRequests.status"] = status;
    }

    const users = await User.aggregate([
      { $unwind: "$withdrawalRequests" },
      { $match: matchCondition },
      {
        $lookup: {
          from: "users",
          localField: "withdrawalRequests.processedBy",
          foreignField: "_id",
          as: "processedBy"
        }
      },
      {
        $project: {
          _id: 1,
          fullName: 1,
          username: 1,
          email: 1,
          phoneNo: 1,
          role: 1,
          commissionWallet: 1,
          withdrawalRequest: "$withdrawalRequests",
          processedBy: { $arrayElemAt: ["$processedBy.fullName", 0] }
        }
      },
      { $sort: { "withdrawalRequest.requestedAt": -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    ]);

    res.status(200).json({
      success: true,
      withdrawalRequests: users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(users.length / limit),
        hasNext: page * limit < users.length,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error("Error fetching withdrawal requests:", error);
    res.status(500).json({ message: "Error fetching withdrawal requests", error: error.message });
  }
};

// Get remaining days stats dashboard
export const getRefferalDashboardStats = asyncHandler(async (req, res) => {
  // Assume req.user._id is set by auth middleware
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  // Get user with referral and subscription info
  const user = await User.findById(userId).lean();

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Calculate days remaining in subscription
  let daysRemaining = 0;
  if (user.subscription && user.subscription.endDate) {
    const now = new Date();
    const end = new Date(user.subscription.endDate);
    daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  }

  // Total referrals (direct)
  const totalReferrals = user.referral?.totalReferrals || 0;

  // Total earnings (commission wallet + totalCommissionEarned)
  const totalEarnings = user.referral?.totalCommissionEarned || 0;

  // Wallet balance (commission wallet)
  const walletBalance = user.commissionWallet || 0;
  // Prepare response
  res.json({
    success: true,
    daysRemaining,
    totalReferrals,
    totalEarnings,
    walletBalance,
    subscriptionStatus: user.subscription?.isActive ? "active" : "inactive",
    referralCode: user.referral?.referralCode || "",
    plan: user.subscription?.plan || "basic"
  });
});

// @desc    Get referral stats
// @route   GET /api/v1/user/referrals/stats
// @access  Private
export const getReferralStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const totalReferrals = user.referral.totalReferrals || 0;
  const successfulConversions = user.referral.referredUsers?.filter(
    (r) => r.totalCommissionEarned > 0
  ).length || 0;

  const totalEarned = user.referral.totalCommissionEarned || 0;

  const pendingApprovals = user.referral.referredUsers?.filter(
    (r) => r.totalCommissionEarned === 0
  ).length || 0;

  res.json({
    totalReferrals,
    successfulConversions,
    totalEarned,
    pendingApprovals,
  });
});

// @desc    Get referral history
// @route   GET /api/v1/user/referrals/history
// @access  Private
export const getReferralHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).populate("referral.referredUsers.userId");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const history = (user.referral.referredUsers || []).map((ref) => {
    const referredUser = ref.userId;

    return {
      date: ref.joinedAt?.toISOString().split("T")[0] || "N/A",
      email: referredUser?.email || "N/A",
      status: ref.totalCommissionEarned > 0 ? "Converted" : "Pending",
      earnings: ref.totalCommissionEarned || 0,
    };
  });

  res.json(history);
});


export const getSubscriptionAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const fiveDaysLater = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));

    // Active subscriptions
    const activeSubscriptions = await User.countDocuments({
      "subscription.isActive": true
    });

    // Expiring within 5 days
    const expiringSoon = await User.countDocuments({
      "subscription.endDate": { $lte: fiveDaysLater },
      "subscription.isActive": true
    });

    // Cancelled today (expired today)
    const cancelledToday = await User.countDocuments({
      "subscription.endDate": {
        $gte: startOfDay,
        $lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
      },
      "subscription.isActive": false
    });

    // New this month
    const newThisMonth = await User.countDocuments({
      "subscription.startDate": { $gte: startOfMonth }
    });

    // Plan-wise active users and revenue
    const aggregation = await User.aggregate([
      {
        $match: {
          "subscription.isActive": true
        }
      },
      {
        $group: {
          _id: "$subscription.plan",
          activeUsers: { $sum: 1 },
          totalRevenue: { $sum: "$subscription.amount" }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        activeSubscriptions,
        expiringSoon,
        cancelledToday,
        newThisMonth,
        planStats: aggregation // [{ _id: 'basic', activeUsers: 5, totalRevenue: 1000 }]
      }
    });
  } catch (err) {
    console.error("Subscription analytics error:", err);
    res.status(500).json({ success: false, message: "Analytics failed" });
  }
};

/**
 * Check tenant subscription status
 * Called by frontend to determine if subscription modal should be shown
 * 
 * Request: expects tenantId in request (from user object or JWT context)
 * Response: { isActive: boolean, subscription: {...}, status: string, message: string }
 */
export const checkTenantSubscription = async (req, res) => {
  try {
    // Get tenantId from authenticated user
    const user = req.user;
    
    if (!user || !user.tenantId) {
      return res.status(400).json({
        success: false,
        message: "User or tenant information not found",
        isActive: false
      });
    }

    const tenantId = user.tenantId._id || user.tenantId;

    // Fetch tenant subscription data
    const tenant = await Tenant.findById(tenantId).select(
      "subscriptionPlan status name code"
    );

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
        isActive: false
      });
    }

    // Check if subscription is active
    const subscription = tenant.subscriptionPlan;
    const isActive = subscription?.isActive === true;
    const endDate = subscription?.endDate ? new Date(subscription.endDate) : null;
    const now = new Date();
    const isExpired = endDate && endDate < now;

    // Determine status
    let statusMessage = "active";
    if (!isActive) {
      statusMessage = "inactive";
    } else if (isExpired) {
      statusMessage = "expired";
    }

    return res.status(200).json({
      success: true,
      isActive: isActive && !isExpired,
      subscription: {
        planDuration: subscription?.planDuration,
        planLayer: subscription?.planLayer,
        startDate: subscription?.startDate,
        endDate: subscription?.endDate,
        price: subscription?.price,
        paymentStatus: subscription?.paymentStatus
      },
      status: statusMessage,
      tenantName: tenant.name,
      tenantCode: tenant.code,
      tenantStatus: tenant.status,
      message: isActive && !isExpired ? "Subscription is active" : "Subscription is not active"
    });
  } catch (error) {
    console.error("Error checking tenant subscription:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking subscription status",
      isActive: false,
      error: error.message
    });
  }
};

/**
 * Get full tenant details (for admin dashboard)
 */
export const getTenantDetails = async (req, res) => {
  try {
    const user = req.user;

    if (!user || !user.tenantId) {
      return res.status(400).json({
        success: false,
        message: "User or tenant information not found"
      });
    }

    const tenantId = user.tenantId._id || user.tenantId;
    const tenant = await Tenant.findById(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: tenant
    });
  } catch (error) {
    console.error("Error fetching tenant details:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching tenant details",
      error: error.message
    });
  }
};



// // controllers/upiScreenshotController.js
// const cloudinary = require('cloudinary').v2;
// const multer = require('multer');
// const path = require('path');


// // Multer configuration for memory storage
// const storage = multer.memoryStorage();
// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: 5 * 1024 * 1024 // 5MB limit
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = /jpeg|jpg|png|gif|webp/;
//     const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = allowedTypes.test(file.mimetype);

//     if (mimetype && extname) {
//       return cb(null, true);
//     } else {
//       cb(new Error('Only image files are allowed!'));
//     }
//   }
// }).single('screenshot');

// ✅ Razorpay Payout Function
const initiateRazorpayPayout = async (payoutData) => {
  const { amount, accountNumber, ifscCode, accountHolderName, bankName, userId, requestId } = payoutData;

  // 🔍 Fraud Prevention: Check for suspicious patterns
  if (amount > 10000000) { // ₹1,00,000 limit per payout (in paise)
    throw new Error("Payout amount exceeds maximum limit of ₹1,00,000");
  }

  const canUseRazorpayPayout = Boolean(
    razorpay?.contacts?.create &&
    razorpay?.fundAccounts?.create &&
    razorpay?.payouts?.create &&
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET
  );

  if (!canUseRazorpayPayout) {
    return initiateManualPayout(payoutData);
  }

  try {
    // Step 1: Create Contact (Beneficiary)
    const contact = await razorpay.contacts.create({
      name: accountHolderName,
      email: `user_${userId}@temp.com`, // Temporary email
      contact: "9999999999", // Temporary phone
      type: "customer",
      reference_id: `USER_${userId}`
    });

    // Step 2: Create Fund Account (Bank Account)
    const fundAccount = await razorpay.fundAccounts.create({
      contact_id: contact.id,
      account_type: "bank_account",
      bank_account: {
        name: accountHolderName,
        ifsc: ifscCode,
        account_number: accountNumber,
        bank_name: bankName || "Unknown Bank"
      }
    });

    // Step 3: Create Payout
    const payout = await razorpay.payouts.create({
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER, // Your Razorpay account
      fund_account_id: fundAccount.id,
      amount: amount, // Amount in paise
      currency: "INR",
      mode: "IMPS", // NEFT, RTGS, IMPS
      purpose: "payout",
      queue_if_low_balance: false,
      reference_id: `WD_${requestId}`,
      narration: `Commission Withdrawal - ${requestId}`
    });

    return {
      payoutId: payout.id,
      status: payout.status,
      amount: payout.amount / 100,
      contactId: contact.id,
      fundAccountId: fundAccount.id
    };

  } catch (error) {
    console.error("Razorpay payout error:", error);
    throw new Error(`Payout failed: ${error.message}`);
  }
};

// ✅ Manual Payout Function (for when Razorpay is not available)
const initiateManualPayout = async (payoutData) => {
  const { amount, accountNumber, ifscCode, accountHolderName, bankName, userId, requestId } = payoutData;

  // This would integrate with your bank's API or create a manual payout record
  // For now, we'll just log it and mark as manual

  console.log(`📋 Manual Payout Required:
    Amount: ₹${amount / 100}
    Account: ${accountNumber}
    IFSC: ${ifscCode}
    Name: ${accountHolderName}
    Bank: ${bankName}
    User ID: ${userId}
    Request ID: ${requestId}
  `);

  return {
    payoutId: `MANUAL_${requestId}`,
    status: "manual_pending",
    amount: amount / 100,
    mode: "manual"
  };
};

// ============================================
// 🔒 RAZORPAY WEBHOOK HANDLER (SECURITY CRITICAL)
// ============================================
/**
 * Handles Razorpay webhooks for automatic payment verification
 * This is called directly by Razorpay servers, not by the frontend
 * Provides an additional layer of security beyond frontend verification
 */
export const handleRazorpayWebhook = async (req, res) => {
  try {
    const crypto = await import('crypto');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('⚠️ RAZORPAY_WEBHOOK_SECRET not configured');
      return res.status(400).json({ error: 'Webhook secret not configured' });
    }

    // Get the signature from headers
    const razorpaySignature = req.headers['x-razorpay-signature'];

    if (!razorpaySignature) {
      return res.status(400).json({ error: 'Missing signature header' });
    }

    // Verify the webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (razorpaySignature !== expectedSignature) {
      console.error('❌ Webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // Signature verified - process the event
    const event = req.body;
    console.log('✅ Webhook verified:', event.event);

    // Handle different event types
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      case 'subscription.charged':
        await handleSubscriptionCharged(event.payload.payment.entity);
        break;
      default:
        console.log('Unhandled event type:', event.event);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Helper function to handle captured payments
async function handlePaymentCaptured(payment) {
  try {
    const { order_id, payment_id, amount } = payment;
    const userId = payment.notes?.userId;

    if (!userId) {
      console.warn('No userId in payment notes:', payment_id);
      return;
    }

    console.log(`💰 Payment captured: ₹${amount/100} for user ${userId}`);

    // Find user and renew subscription
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found for webhook:', userId);
      return;
    }

    // Check if already processed (prevent duplicate processing)
    if (user.subscription?.lastPaymentId === payment_id) {
      console.log('⚠️ Payment already processed:', payment_id);
      return;
    }

    // Renew subscription (30 days from now)
    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + 30);

    user.subscription = {
      ...user.subscription,
      isActive: true,
      endDate: newEndDate,
      startDate: new Date(),
      plan: user.subscription?.plan || 'basic',
      amount: amount / 100,
      lastPaymentId: payment_id,
      lastPaymentDate: new Date()
    };

    await user.save();
    await user.logActivity('subscription_renewed_webhook', {
      paymentId: payment_id,
      orderId: order_id,
      amount: amount / 100,
      method: 'razorpay_webhook'
    });

    console.log(`✅ Subscription renewed via webhook for user ${userId}`);
  } catch (error) {
    console.error('Error processing captured payment:', error);
  }
}

// Helper function to handle failed payments
async function handlePaymentFailed(payment) {
  try {
    const userId = payment.notes?.userId;
    if (!userId) return;

    console.log(`❌ Payment failed for user ${userId}:`, payment.description);

    const user = await User.findById(userId);
    if (user) {
      await user.logActivity('subscription_payment_failed', {
        paymentId: payment.id,
        reason: payment.description,
        method: 'razorpay_webhook'
      });
    }
  } catch (error) {
    console.error('Error processing failed payment:', error);
  }
}

// Helper function to handle subscription charges
async function handleSubscriptionCharged(payment) {
  try {
    const userId = payment.notes?.userId;
    if (!userId) return;

    console.log(`🔄 Subscription charged for user ${userId}`);
    // Handle recurring subscription logic here
  } catch (error) {
    console.error('Error processing subscription charge:', error);
  }
}

// ✅ Phase 6: Central Ledger Report for SuperAdmin
export const getCentralLedgerReport = async (req, res) => {
  try {
    const { startDate, endDate, limit = 50 } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = { $gte: thirtyDaysAgo, $lte: new Date() };
    }

    // Fetch Aggregated Stats
    const stats = await Ledger.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: null,
          totalWalletTopups: {
            $sum: { $cond: [{ $regexMatch: { input: "$description", regex: /Wallet top-up via Central Razorpay/i } }, "$amount", 0] }
          },
          totalSubscriptionRevenue: {
            $sum: { $cond: [{ $eq: ["$remarks", "Razorpay Subscription Renewal"] }, "$amount", 0] }
          },
          totalPayouts: {
            $sum: { $cond: [{ $eq: ["$remarks", "RazorpayX Payout"] }, "$amount", 0] }
          }
        }
      }
    ]);

    const finalStats = stats[0] || { totalWalletTopups: 0, totalSubscriptionRevenue: 0, totalPayouts: 0 };
    const totalCashInflow = finalStats.totalWalletTopups + finalStats.totalSubscriptionRevenue;
    const totalCashOutflow = finalStats.totalPayouts;
    const netSystemBalance = totalCashInflow - totalCashOutflow;

    // Fetch Recent Platform Transactions
    const recentTransactions = await Ledger.find({
      createdAt: dateFilter,
      $or: [
        { description: /Wallet top-up via Central Razorpay/i },
        { remarks: "Razorpay Subscription Renewal" },
        { remarks: "RazorpayX Payout" }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .populate('userId', 'fullName username role');

    res.status(200).json({
      success: true,
      message: "Central ledger report fetched successfully",
      data: {
        stats: {
          ...finalStats,
          totalCashInflow,
          totalCashOutflow,
          netSystemBalance
        },
        recentTransactions
      }
    });
  } catch (error) {
    console.error("Error fetching central ledger report:", error);
    res.status(500).json({ message: "Error fetching central ledger report", error: error.message });
  }
};
