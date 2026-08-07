import mongoose, { Schema } from "mongoose";
import { Tenant } from "./tenant.model.js";
import { Ledger } from "./ledger.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    profileimage: {
      type: String,
      default: ""
    },
    nabllogo: {
      type: String,
      default: ""
    },
    profileimagepublicid: {
      type: String,
      default: ""
    },
    nabllogopublicid: {
      type: String,
      default: ""
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: [
        "admin",
        "superFranchisee",
        "franchisee",
        "subFranchisee",
        "staff",
      ],
    },
    password: {
      type: String,
      required: [true, "password is required"],
      trim: true,
    },
    refreshToken: {
      type: String,
    },

    // Booking wallet - separate from commission wallet
    bookingWallet: {
      type: Number,
      default: 0,
    },

    // Commission wallet - for referral earnings
    commissionWallet: {
      type: Number,
      default: 0,
    },
    // Overdraft / negative balance permission
    // If `overdraftAllowed` is true the bookingWallet may go negative up to `overdraftLimit`
    overdraftAllowed: {
      type: Boolean,
      default: false,
    },
    overdraftLimit: {
      type: Number,
      default: 0,
    },

    // Admin permission for superFranchisee to manage overdraft limits for their franchisees
    canManageOverdraft: {
      type: Boolean,
      default: false,
    },

    // Subscription Management
    subscription: {
      // duration of subscription
      plan: {
        type: String,
        enum: ["basic", "monthly", "quaterly", "yearly"],
        default: "basic",
      },
      // model layer (1layer..4layer)
      planLayer: {
        type: String,
        enum: ["1layer", "2layer", "3layer", "4layer"],
        default: "1layer",
      },
      amount: {
        type: Number,
        default: 700,
      },
      startDate: {
        type: Date,
        default: Date.now,
      },
      endDate: {
        type: Date,
        default: function () {
          return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        },
      },
      isActive: {
        type: Boolean,
        default: true,
      },
      autoRenew: {
        type: Boolean,
        default: false,
      },
      renewalHistory: [
        {
          renewedAt: Date,
          amount: Number,
          paymentMethod: String,
          transactionId: String,
          referralCommissionPaid: Number,
          referredBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
          },
          role: {
            type: String,
            enum: ["admin", "superFranchisee", "franchisee", "subFranchisee", "staff"],
          },
          // keep duration and layer separate for clarity
          planDuration: {
            type: String,
            enum: ["basic", "monthly", "quaterly", "yearly"],
          },
          planLayer: {
            type: String,
            enum: ["1layer", "2layer", "3layer", "4layer"],
          },
          monthlyAmount: Number,
        },
      ],
    },

    // Referral System
    referral: {
      referredBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
      referralCode: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
      },
      referredUsers: [
        {
          userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
          },
          joinedAt: {
            type: Date,
            default: Date.now,
          },
          totalCommissionEarned: {
            type: Number,
            default: 0,
          },
        },
      ],
      totalReferrals: {
        type: Number,
        default: 0,
      },
      totalCommissionEarned: {
        type: Number,
        default: 0,
      },
    },

    createdAt: { type: Date, default: Date.now },
    phoneNo: Number,
    state: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
    },
    postOffice: {
      type: String,
    },
    pinCode: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Booking Ledger
    bookingLedger: [
      {
        transactionId: String,
        type: { type: String, enum: ["credit", "debit"] },
        amount: Number,
        description: String,
        balanceAfterTransaction: Number,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Commission Ledger
    commissionLedger: [
      {
        transactionId: String,
        type: { type: String, enum: ["credit", "debit", "withdrawal"] },
        amount: Number,
        description: String,
        referredUserId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        balanceAfterTransaction: Number,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Withdrawal Requests
    withdrawalRequests: [
      {
        requestId: {
          type: String,
          unique: true,
          sparse: true, // ✅ This allows multiple null/undefined values while keeping actual values unique
        },
        amount: Number,
        status: {
          type: String,
          enum: ["pending", "approved", "rejected", "processed"],
          default: "pending",
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
        processedAt: Date,
        processedBy: {
          type: Schema.Types.ObjectId,
          ref: "SuperAdmin",
        },
        bankDetails: {
          accountNumber: String,
          ifscCode: String,
          accountHolderName: String,
          bankName: String,
        },
        rejectionReason: String,
        payoutStatus: {
          type: String,
          enum: ["not_started", "pending", "completed", "failed"],
          default: "not_started",
        },
        payoutReference: String,
        payoutMode: {
          type: String,
          enum: ["manual", "bank_transfer", "razorpay_payout"],
          default: "manual",
        },
      },
    ],
// if user model create path parentUser  is required at validate
    parentUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        // Only require parentUser if the role is NOT admin or superAdmin
        // Previously this only excluded "superAdmin" which caused a validation
        // error when creating an 'admin' user during tenant signup.
        return !["admin", "superAdmin"].includes(this.role);
      },
      index: true,
    },

    pdfFormat: {
      type: String,
      default: "reportFormat",
    },
    showtestdatabase: {
      type: Boolean,
      default: true,
    },
    showprintsetting: {
      type: Boolean,
      default: false,
    },
    showRandomBtn: {
      type: Boolean,
      default: false,
    },
    permissions: {
      canManageBookings: { type: Boolean, default: true },
      canManageTest: { type: Boolean, default: false },
      canManagePayments: { type: Boolean, default: false },
      canViewReports: { type: Boolean, default: false },
      canManageUsers: { type: Boolean, default: false },
    },

    // Bank Details for Payouts (Admin, Franchisee, Sub-Franchisee)
    bankDetails: {
      accountNumber: { type: String },
      ifscCode: { type: String },
      accountHolderName: { type: String },
      bankName: { type: String },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date }
    },

    // Razorpay Account for Receiving Payments (Admin level) - Optional
    // If not set, uses superadmin's account with virtual sub-accounts
    razorpayAccount: {
      razorpayKeyId: { type: String },
      razorpayKeySecret: { type: String },
      accountNumber: { type: String }, // Razorpay account number
      isActive: { type: Boolean, default: false },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date }
    },

    // Virtual Account for Razorpay Sub-Account System
    virtualAccount: {
      virtualAccountId: { type: String }, // Razorpay virtual account ID
      accountNumber: { type: String }, // Virtual account number
      ifscCode: { type: String }, // Virtual IFSC
      isActive: { type: Boolean, default: false },
      createdAt: { type: Date }
    },

    lastLogin: {
      type: Date,
    },
    parentRole: {
      type: String,
      enum: [
        "superAdmin",
        "admin",
        "franchisee",
        "superFranchisee",
        "subFranchisee",
        "staff",
      ],
      default: "staff",
    },
    activities: [
      {
        activityType: {
          type: String,
          enum: [
            "login",
            "booking",
            "payment",
            "user_management",
            "test_create",
            "parameter_update",
            "subscription_renewal",
            "subscription_renewed_webhook",
            "subscription_payment_failed",
            "subscription_expiry", // ✅ Add this line
            "referral_commission",
            "new_referral",
            "withdrawal_request",
            "withdrawal_processed",
            "withdrawal_rejected",
            "withdrawal_failed",
            "bank_details_updated",
            "razorpay_account_setup",
            "payment_to_admin",
            "payment_from_franchisee",
            "razorpay_payment_received",
            "razorpay_payment_sent",
            "wallet_topup_success",
            "wallet_topup_received",
            'booking_created',
            'booking_updated',
            'booking_deleted',
            'booking_cancellation',
            'expiry_warning_sent',
            "other",
          ],
        },
        details: {
          type: Schema.Types.Mixed,
        },
        reference: {
          model: String,
          id: Schema.Types.ObjectId,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
userSchema.index({ "subscription.endDate": 1 });
userSchema.index({ "subscription.isActive": 1 });
userSchema.index({ tenantId: 1, role: 1, isActive: 1, fullName: 1 });

// Pre-save middleware for password hashing
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Generate unique referral code
userSchema.pre("save", function (next) {
  if (!this.referral.referralCode && this.isNew) {
    this.referral.referralCode =
      this.username.toUpperCase() +
      Math.random().toString(36).substr(2, 6).toUpperCase();
  }
  next();
});

// FIXED: Pre-save middleware to handle parentUser for existing users
userSchema.pre("save", function (next) {
  // If this is an existing user being updated and parentUser is not set
  if (!this.isNew && !this.parentUser) {
    const rolesWithoutParent = ['admin', 'superAdmin'];
    if (!rolesWithoutParent.includes(this.role)) {
      // Set parentUser to null instead of leaving it undefined
      this.parentUser = null;
    }
  }
  next();
});

// Methods
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      tenantId: this.tenantId,
      role: this.role,
    },
    process.env.SUPER_ADMIN_ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.SUPER_ADMIN_REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

// // Check if subscription is expired
// userSchema.methods.isSubscriptionExpired = function () {
//   return new Date() > this.subscription.endDate;
// };

// // Check if subscription is about to expire (within 5 days)
// userSchema.methods.isSubscriptionExpiringSoon = function () {
//   const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
//   return this.subscription.endDate <= fiveDaysFromNow;
// };

// // FIXED: Deactivate expired subscription - use updateOne to avoid validation
// userSchema.methods.deactivateExpiredSubscription = async function () {
//   if (this.isSubscriptionExpired()) {
//     // Use updateOne to avoid triggering validation
//     await this.constructor.updateOne(
//       { _id: this._id },
//       {
//         'subscription.isActive': false,
//         'isActive': false,
//         $push: {
//           activities: {
//             activityType: "subscription_expiry",
//             details: {
//               expiredAt: new Date(),
//               plan: this.subscription.plan,
//             },
//             timestamp: new Date()
//           }
//         }
//       }
//     );
//     return { success: true };
//   }
//   return { success: false };
// };

// FIXED: Safer renewal method
userSchema.methods.renewSubscription = async function (paymentDetails) {
  try {
    const { amount = 0, paymentMethod = 'manual', transactionId, durationMonths, planType, monthlyAmount } = paymentDetails || {};

    // Determine duration in months
    let months = 0;
    if (typeof durationMonths === 'number' && durationMonths > 0) {
      months = Math.floor(durationMonths);
    } else if (planType) {
      const pt = String(planType).toLowerCase();
      if (pt === 'quaterly' || pt === 'quarterly') months = 3;
      else if (pt === 'yearly' || pt === 'annual') months = 12;
      else months = 1;
    } else {
      // Fallback: infer months from amount vs price (if price provided in schema)
      const pricePerMonth = (this.subscription && this.subscription.amount) ? Number(this.subscription.amount) : 2000;
      months = Math.max(1, Math.round(Number(amount || pricePerMonth) / pricePerMonth));
    }

    const now = new Date();
    const tenant = await Tenant.findOne({ 'adminDetails.userId': this._id });
    const tenantSubscription = tenant?.subscriptionPlan;
    const subscriptionSource = tenantSubscription || this.subscription || {};

    const paidAmount = Number(amount || 0);
    const explicitMonthlyAmount = Number(monthlyAmount);
    const monthlyRate = Number.isFinite(explicitMonthlyAmount) && explicitMonthlyAmount > 0
      ? explicitMonthlyAmount
      : (months > 0 ? Math.round((paidAmount / months) * 100) / 100 : paidAmount);
    const planLayer = subscriptionSource?.planLayer || this.subscription?.planLayer || "1layer";
    const addedMs = months * 30 * 24 * 60 * 60 * 1000;

    // Compute new user subscription end by extending if active
    const sourceEndDate = subscriptionSource?.endDate || this.subscription?.endDate;
    const sourceStartDate = subscriptionSource?.startDate || this.subscription?.startDate;
    const sourceIsActive = subscriptionSource?.isActive !== undefined ? subscriptionSource.isActive : this.subscription?.isActive;
    const userCurrentEnd = sourceEndDate ? new Date(sourceEndDate) : null;
    let newUserEnd;
    let userStartToSet;
    if (userCurrentEnd && sourceIsActive && userCurrentEnd.getTime() > now.getTime()) {
      newUserEnd = new Date(userCurrentEnd.getTime() + addedMs);
      userStartToSet = sourceStartDate || now;
    } else {
      newUserEnd = new Date(now.getTime() + addedMs);
      userStartToSet = now;
    }

    // Commission handling
    const commissionRate = 0.2;
    const commissionAmount = Number(amount || 0) * commissionRate;
    let referralCommissionPaid = 0;

    // Determine planDuration from months for renewal history
    let planDuration = 'monthly';
    if (months >= 12) planDuration = 'yearly';
    else if (months >= 3) planDuration = 'quaterly';
    else planDuration = 'monthly';

    // Prepare renewal entry
    const renewalEntry = {
      renewedAt: now,
      amount: Number(amount || 0),
      paymentMethod,
      transactionId: transactionId || `MANUAL_${Date.now()}`,
      referralCommissionPaid: 0,
      role: this.role,
      plan: subscriptionSource?.planType || this.subscription?.plan,
      monthlyAmount: monthlyRate,
      planDuration: planDuration,  // ✅ Added: subscription duration
      planLayer: planLayer,
    };


    // If referred, compute and credit referrer
    if (this.referral && this.referral.referredBy) {
      const referrer = await this.constructor.findById(this.referral.referredBy);
      if (referrer) {
        referralCommissionPaid = Number(commissionAmount) || 0;
        // Update referrer with commission
        const prevReferrerBalance = Number(referrer.commissionWallet || 0);
        const newReferrerBalance = prevReferrerBalance + referralCommissionPaid;

        await this.constructor.updateOne(
          { _id: referrer._id },
          {
            $inc: { commissionWallet: referralCommissionPaid, 'referral.totalCommissionEarned': referralCommissionPaid },
            $push: {
              commissionLedger: {
                transactionId: `COMM_${transactionId || Date.now()}`,
                type: 'credit',
                amount: referralCommissionPaid,
                description: `Referral commission from ${this.fullName}'s subscription renewal`,
                referredUserId: this._id,
                balanceAfterTransaction: newReferrerBalance,
                createdAt: new Date(),
              },
              activities: {
                activityType: 'referral_commission',
                details: { amount: referralCommissionPaid, fromUser: this.fullName, transactionId: transactionId },
                timestamp: new Date(),
              }
            }
          }
        );

        await Ledger.create({
          userId: referrer._id,
          username: referrer.username,
          role: referrer.role,
          transactionId: `COMM_${transactionId || Date.now()}`,
          type: "credit",
          amount: referralCommissionPaid,
          description: `Referral commission from ${this.fullName}'s subscription renewal`,
          remarks: "Referral Commission",
          balanceAfterTransaction: newReferrerBalance,
          receivedFrom: this.fullName || this.username,
          createdAt: new Date(),
        });

        renewalEntry.referralCommissionPaid = referralCommissionPaid;
        renewalEntry.referredBy = this.referral.referredBy;
      }
    }

    // Build user update object
    const updateObj = {
      $set: {
        'subscription.startDate': userStartToSet,
        'subscription.endDate': newUserEnd,
        'subscription.isActive': true,
        'subscription.plan': planDuration,
        'subscription.amount': monthlyRate,
        isActive: true,
      },
      $push: {
        'subscription.renewalHistory': renewalEntry,
        activities: {
          activityType: 'subscription_renewal',
          details: {
            amount: Number(amount || 0),
            plan: planDuration,
            paymentMethod,
            transactionId: renewalEntry.transactionId || renewalEntry.transactionId,
            durationMonths: months,
            monthlyAmount: monthlyRate,
          },
          timestamp: now,
        }
      }
    };

    // Update the user record
    await this.constructor.updateOne({ _id: this._id }, updateObj);

    // Update Tenant subscription plan if exists (extend if active)
    if (tenant) {
      const tenantCurrentEnd = tenant.subscriptionPlan?.endDate ? new Date(tenant.subscriptionPlan.endDate) : null;
      let newTenantEnd;
      let tenantStartToSet;
      if (tenantCurrentEnd && tenant.subscriptionPlan?.isActive && tenantCurrentEnd.getTime() > now.getTime()) {
        newTenantEnd = new Date(tenantCurrentEnd.getTime() + addedMs);
        tenantStartToSet = tenant.subscriptionPlan.startDate || now;
      } else {
        newTenantEnd = new Date(now.getTime() + addedMs);
        tenantStartToSet = now;
      }

      await Tenant.updateOne(
        { _id: tenant._id },
        {
          $set: {
            'subscriptionPlan.isActive': true,
            'subscriptionPlan.paymentStatus': 'paid',
            'subscriptionPlan.startDate': tenantStartToSet,
            'subscriptionPlan.endDate': newTenantEnd,
            'subscriptionPlan.price': monthlyRate,
            'subscriptionPlan.planType': planDuration,
            'subscriptionPlan.planLayer': planLayer,
            'subscriptionPlan.planDuration': planDuration
          },
          $push: {
            'subscriptionPlan.renewalHistory': {
              renewedAt: now,
              amount: paidAmount,
              paymentMethod,
              transactionId: renewalEntry.transactionId,
              referralCommissionPaid,
              planDuration,
              planLayer,
              monthlyAmount: monthlyRate,
            }
          }
        }
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Error in renewSubscription:', error);
    throw error;
  }
};

// Request withdrawal
userSchema.methods.requestWithdrawal = async function (amount, bankDetails = null) {
  if (amount > this.commissionWallet) {
    throw new Error("Insufficient commission balance");
  }

  // If no bank details provided, use saved bank details
  if (!bankDetails && this.bankDetails) {
    bankDetails = this.bankDetails;
  }

  if (!bankDetails || !bankDetails.accountNumber) {
    throw new Error("Bank details required for withdrawal");
  }

  const requestId = `WD_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 6)
    .toUpperCase()}`;

  // Use updateOne to avoid validation issues
  await this.constructor.updateOne(
    { _id: this._id },
    {
      $push: {
        withdrawalRequests: {
          requestId: requestId,
          amount: amount,
          bankDetails: bankDetails,
          requestedAt: new Date(),
        },
        activities: {
          activityType: "withdrawal_request",
          details: {
            amount: amount,
            requestId: requestId,
            bankDetails: {
              accountNumber: bankDetails.accountNumber.slice(-4), // Log only last 4 digits
              ifscCode: bankDetails.ifscCode,
              bankName: bankDetails.bankName
            },
          },
          timestamp: new Date()
        }
      }
    }
  );

  return { success: true, requestId };
};

// Use commission for renewal
userSchema.methods.renewWithCommission = async function (totalAmount) {
  const commissionToUse = Math.min(this.commissionWallet, totalAmount);
  const remainingAmount = totalAmount - commissionToUse;

  if (commissionToUse > 0) {
    // Use updateOne to avoid validation
    await this.constructor.updateOne(
      { _id: this._id },
      {
        $inc: { commissionWallet: -commissionToUse },
        $push: {
          commissionLedger: {
            transactionId: `RENEWAL_${Date.now()}`,
            type: "debit",
            amount: commissionToUse,
            description: "Used commission for subscription renewal",
            balanceAfterTransaction: this.commissionWallet - commissionToUse,
          }
        }
      }
    );
  }

  return {
    commissionUsed: commissionToUse,
    remainingAmount: remainingAmount,
  };
};

// FIXED: Safer log activity method
userSchema.methods.logActivity = async function (activityType, details, reference = null) {
  try {
    const activity = {
      activityType,
      details,
      timestamp: new Date(),
    };

    if (reference) {
      activity.reference = reference;
    }

    // Use updateOne to avoid validation issues
    await this.constructor.updateOne(
      { _id: this._id },
      { $push: { activities: activity } }
    );

    return { success: true };
  } catch (error) {
    console.error('Error logging activity:', error);
    return { success: false, error: error.message };
  }
};

// // Static method to get users with expiring subscriptions
// userSchema.statics.getExpiringSubscriptions = async function (days = 5) {
//   const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

//   return this.find({
//     "subscription.endDate": { $lte: expiryDate, $gte: new Date() },
//     "subscription.isActive": true,
//   });
// };

export const User = mongoose.model("User", userSchema);
