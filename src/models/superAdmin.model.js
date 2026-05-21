// models/superAdmin.model.js
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// SuperAdmin Schema with Optimized Indexes
const superAdminSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true, // Automatically creates unique index
        trim: true,
        lowercase: true,
    },
    email: {
        type: String,
        required: true,
        unique: true, // Automatically creates unique index
        trim: true,
        lowercase: true,
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        trim: true,
    },
    phoneNo: {
        type: String,
        required: true,
        index: true, // For phone-based searches
    },
    refreshToken: {
        type: String,
        sparse: true, // Only index non-null values
    },
    lastLogin: {
        type: Date,
        index: true, // For activity tracking
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true, // For filtering active users
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true, // For time-based queries
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "SuperAdmin",
        index: true,
    },
    role: {
        type: String,
        enum: ["superAdmin", "staff"],
        index: true, // For role-based queries
    },
    parentRole: {
        type: String,
        default: null,
    },
    parentUser: {
        type: Schema.Types.ObjectId,
        ref: "SuperAdmin",
        index: true,
    },
    state: {
        type: String,
        index: true, // For location-based queries
    },
    city: {
        type: String,
        index: true, // For location-based queries
    },
    pinCode: {
        type: Number,
        index: true,
    },
    address: {
        type: String,
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
                    "panel_create",
                    "package_create",
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
    permissions: {
        canManageBookings: { type: Boolean, default: false },
        canManageTest: { type: Boolean, default: false },
        canManagePayments: { type: Boolean, default: false },
        canViewReports: { type: Boolean, default: false },
        canManageUsers: { type: Boolean, default: false },
    },
}, {
    timestamps: true,
});

// Compound indexes for SuperAdmin
superAdminSchema.index({ role: 1, isActive: 1 }); // For filtering active users by role
superAdminSchema.index({ state: 1, city: 1 }); // For location-based queries
superAdminSchema.index({ createdAt: -1, role: 1 }); // For time-based role queries
superAdminSchema.index({ "activities.timestamp": -1 }); // For activity tracking


superAdminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

superAdminSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

superAdminSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      role: "superAdmin",
    },
    process.env.SUPER_ADMIN_ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

superAdminSchema.methods.generateRefreshToken = function () {
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

export const SuperAdmin = mongoose.model("SuperAdmin", superAdminSchema);
