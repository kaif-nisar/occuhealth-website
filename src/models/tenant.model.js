// tenant.model.js
import mongoose, { Schema } from "mongoose";

const tenantSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    logo: {
      type: String,
      default: ""
    },
    logopublicid: {
      type: String,
      default: ""
    },
    modelType: {
      type: String,
      enum: ["4layer", "3layer", "2layer", "1layer"],
      required: true,
    },
    // Reference to tests purchased from SuperAdmin
    purchasedTests: [
      {
        testId: { type: mongoose.Schema.Types.ObjectId, ref: "testSchema" },
        purchaseDate: { type: Date, default: Date.now },
        price: Number,
      },
    ],
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    adminDetails: {
      email: String,
      username: String,
      userId: { type: Schema.Types.ObjectId, ref: "User" },
    },
    subscriptionPlan: {
      planType: {
        type: String,
        enum: ["monthly", "quaterly", "yearly"],
        default: "monthly",
      },
      planDuration: {
        type: String,
        enum: ["monthly", "quaterly", "yearly"],
        default: "monthly",
      },
      planLayer: {
        type: String,
        default: ""
      },
      startDate: {
        type: Date,
        default: Date.now,
      },
      endDate: {
        type: Date,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      paymentStatus: {
        type: String,
        enum: ["pending", "paid", "overdue"],
        default: "pending",
      },
      isActive: { type: Boolean, default: true },
      renewalHistory: [
        {
          renewedAt: { type: Date, default: Date.now },
          amount: Number,
          paymentMethod: String,
          transactionId: String,
          referralCommissionPaid: { type: Number, default: 0 },
          referredBy: { type: Schema.Types.ObjectId, ref: "Tenant" },
          planDuration: String,
          planLayer: String,
          monthlyAmount: Number,
        }
      ],
    },
    // Referral System (Admin to Admin)
    referral: {
      referralCode: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
      },
      referredBy: { 
        type: Schema.Types.ObjectId, 
        ref: "Tenant",
        index: true,
      },
      totalCommissionEarned: { 
        type: Number, 
        default: 0 
      },
    },
    analytics: {
      totalUsers: { type: Number, default: 0 },
      totalTests: { type: Number, default: 0 },
      totalBookings: { type: Number, default: 0 },
      monthlyRevenue: { type: Number, default: 0 },
    },
    activities: [
      {
        activityType: String,
        details: Schema.Types.Mixed,
        timestamp: { type: Date, default: Date.now },
      }
    ],
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);


// Pre-save middleware to generate unique referral code
tenantSchema.pre("save", function (next) {
  if (!this.referral.referralCode && this.isNew) {
    this.referral.referralCode =
      this.code.toUpperCase() +
      Math.random().toString(36).substr(2, 6).toUpperCase();
  }
  next();
});

// Check if subscription is expired
tenantSchema.methods.isSubscriptionExpired = function () {
  return new Date() > this.subscriptionPlan.endDate;
};

// Check if subscription is about to expire (within 5 days)
tenantSchema.methods.isSubscriptionExpiringSoon = function () {
  const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  return this.subscriptionPlan.endDate <= fiveDaysFromNow;
};

// tenant.model.js
tenantSchema.statics.deactivateExpiredSubscriptions = async function () {
  try {
    const result = await this.updateMany(
      {
        "subscriptionPlan.endDate": { $lt: new Date() },
        "subscriptionPlan.isActive": true,
      },
      {
        $set: {
          "subscriptionPlan.isActive": false,
          status: "inactive",
        },
      }
    );

    console.log(`🔒 ${result.modifiedCount} tenants deactivated due to subscription expiry.`);
    return result.modifiedCount;
  } catch (error) {
    console.error("❌ Error deactivating expired tenants:", error);
    return 0;
  }
};

// Static method to get users with expiring subscriptions
tenantSchema.statics.getExpiringSubscriptions = async function (days = 5) {
  const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  return this.find({
    "subscriptionPlan.endDate": { $lte: expiryDate, $gte: new Date() },
    "subscriptionPlan.isActive": true,
  });
};

// FIXED: Safer renewal method with proper referral commission
tenantSchema.methods.renewSubscription = async function (paymentDetails) {
  try {
    const { amount = 0, paymentMethod = 'manual', transactionId, durationMonths, planType } = paymentDetails || {};

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
      const pricePerMonth = (this.subscriptionPlan && this.subscriptionPlan.price) ? this.subscriptionPlan.price : 2000;
      months = Math.max(1, Math.round(Number(amount || pricePerMonth) / pricePerMonth));
    }

    const now = new Date();
    const addedMs = months * 30 * 24 * 60 * 60 * 1000;

    // Compute new subscription end
    const currentEnd = this.subscriptionPlan?.endDate ? new Date(this.subscriptionPlan.endDate) : null;
    let newEnd;
    let startToSet;
    if (currentEnd && this.subscriptionPlan?.isActive && currentEnd.getTime() > now.getTime()) {
      newEnd = new Date(currentEnd.getTime() + addedMs);
      startToSet = this.subscriptionPlan.startDate || now;
    } else {
      newEnd = new Date(now.getTime() + addedMs);
      startToSet = now;
    }

    // Commission handling - 20% commission for referrer
    const commissionRate = 0.2;
    const commissionAmount = Number(amount || 0) * commissionRate;
    let referralCommissionPaid = 0;

    // Determine planDuration from months
    let planDuration = 'monthly';
    if (months >= 12) planDuration = 'yearly';
    else if (months >= 3) planDuration = 'quaterly';
    else planDuration = 'monthly';

    const renewalEntry = {
      renewedAt: now,
      amount: Number(amount || 0),
      paymentMethod,
      transactionId: transactionId || `MANUAL_${Date.now()}`,
      referralCommissionPaid: 0,
      planDuration: planDuration,
      planLayer: this.subscriptionPlan?.planLayer,
    };

    // If tenant was referred by another tenant, credit commission
    if (this.referral && this.referral.referredBy) {
      const referrer = await this.constructor.findById(this.referral.referredBy);
      if (referrer) {
        referralCommissionPaid = Number(commissionAmount) || 0;
        const newTotalCommission = Number(referrer.referral?.totalCommissionEarned || 0) + referralCommissionPaid;

        // Update referrer's commission
        await this.constructor.updateOne(
          { _id: referrer._id },
          {
            $set: {
              'referral.totalCommissionEarned': newTotalCommission
            },
            $push: {
              activities: {
                activityType: 'referral_commission',
                details: { 
                  amount: referralCommissionPaid, 
                  fromTenant: this.name, 
                  transactionId: transactionId 
                },
                timestamp: new Date(),
              }
            }
          }
        );

        renewalEntry.referralCommissionPaid = referralCommissionPaid;
        renewalEntry.referredBy = this.referral.referredBy;
      }
    }

    // Build update object
    const updateObj = {
      $set: {
        'subscriptionPlan.startDate': startToSet,
        'subscriptionPlan.endDate': newEnd,
        'subscriptionPlan.isActive': true,
        'subscriptionPlan.paymentStatus': 'paid',
        'subscriptionPlan.planDuration': planDuration,
        status: 'active',
      },
      $push: {
        'subscriptionPlan.renewalHistory': renewalEntry,
        activities: {
          activityType: 'subscription_renewal',
          details: {
            amount: Number(amount || 0),
            planType: planType || this.subscriptionPlan?.planType,
            paymentMethod,
            transactionId: renewalEntry.transactionId,
            durationMonths: months,
          },
          timestamp: now,
        }
      }
    };

    await this.constructor.updateOne({ _id: this._id }, updateObj);
    return { success: true };
  } catch (error) {
    console.error('Error in renewSubscription:', error);
    throw error;
  }
};

export const Tenant = mongoose.model("Tenant", tenantSchema);
