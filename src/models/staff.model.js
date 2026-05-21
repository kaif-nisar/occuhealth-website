// models/staff.model.js
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const staffSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        trim: true
    },
    parentUser: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    tenantId: {
        type: Schema.Types.ObjectId,
        ref: "Tenant",
        required: true,
        index: true
    },
    role: {
        type: String,
        default: "staff"
    },
    parentRole: {
        type: String,
        enum: ["superAdmin", "admin", "franchisee","superFranchisee", "subFranchisee", "staff"],
        default: "staff"
    },
    permissions: {
        canCreateBookings: { type: Boolean, default: false },
        canViewBookings: { type: Boolean, default: true },
        canManagePayments: { type: Boolean, default: false },
        canViewReports: { type: Boolean, default: false },
        canManageUsers: { type: Boolean, default: false },
        // Add more permissions as needed
    },
    phoneNo: {
        type: String,
        required: true
    },
    address: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    state: {
        type: String,
        trim: true
    },
    pinCode: {
        type: String,
        trim: true
    },
    refreshToken: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    activities: [
        {
            activityType: {
                type: String,
                enum: ["login", "booking", "payment", "user_management", "other"]
            },
            details: {
                type: Schema.Types.Mixed  // Allows storing different types of activity details
            },
            reference: {
                model: String,            // e.g., "Booking", "Payment", etc.
                id: Schema.Types.ObjectId // Reference to the related document
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

staffSchema.pre("save", async function(next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

staffSchema.methods.isPasswordCorrect = async function(password) {
    return await bcrypt.compare(password, this.password);
};

staffSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
            _id: this._id,
            parentUser: this.parentUser,
            tenantId: this.tenantId,
            role: this.role
        },
        process.env.SUPER_ADMIN_ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    );
};

staffSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.SUPER_ADMIN_REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    );
};

// Function to log staff activity
staffSchema.methods.logActivity = async function(activityType, details, reference = null) {
    const activity = {
        activityType,
        details,
        timestamp: new Date()
    };
    
    if (reference) {
        activity.reference = reference;
    }
    
    this.activities.push(activity);
    return this.save();
};

export const Staff = mongoose.model("Staff", staffSchema);