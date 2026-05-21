import mongoose, { Schema } from "mongoose";

const packageSchema = new Schema(
  {
    testname: {
      type: [String],
    },
    testSample: {
      type: [String],
    },
    pannelname: {
      type: [String],
    },
    pannelSample: {
      type: [String],
    },
    packageName: {
      type: String,
      required: true,
    },
    final_price: {
      type: String,
      required: true,
    },
    packageFee: {
      type: String,
      required: true,
    },
    testIds: [
      {
        type: mongoose.Types.ObjectId,
        ref: "testSchema",
        required: true,
      },
    ],
    pannelIds: [
      {
        type: mongoose.Types.ObjectId,
        ref: "pannel",
        required: true,
      },
    ],
    assignedPrices: [
      {
        userId: mongoose.Schema.Types.ObjectId, // Assignee (Franchisee or Subfranchisee)
        assignedBy: mongoose.Schema.Types.ObjectId, // Assigner (Admin, Superfranchisee, or Franchisee)
        price: Number, // Price set during assignment
        commission: Number, // Commission for the assigner
        assignedAt: { type: Date, default: Date.now }, // Timestamp
      },
    ],
    packageGender: {
      type: String,
      enum: ["male", "female", "Both"], // Assuming these are the allowed values
      required: true,
    },
    // Multi-tenant fields
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        // Sirf SuperAdmin ke liye optional hai
        return this.createdByRole !== "superAdmin";
      },
      default: null, // Default to null for SuperAdmin tests
      index: true, // For faster queries by tenant
    },
    createdByRole: {
      type: String,
      enum: ["superAdmin", "admin"], // Role of the user who created the test
    },
    // Fields for test ownership and rental management
    isBasePackage: {
      type: Boolean,
      default: false, // True if created by SuperAdmin as a template
    },

    // If this test was rented/purchased from the SuperAdmin
    purchasedFromBasePackage: {
      type: Boolean,
      default: false,
    },

    // Reference to original test if purchased/rented
    originalPackageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "testSchema",
    },

    // For SuperAdmin tests: which tenants have purchased this test
    purchasedBy: [
      {
        tenantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        purchaseDate: {
          type: Date,
          default: Date.now,
        },
        purchasePrice: Number,
      },
    ],

    // assignedPrices: [
    //   {
    //     userId: mongoose.Schema.Types.ObjectId, // Assignee (Franchisee or Subfranchisee)
    //     assignedBy: mongoose.Schema.Types.ObjectId, // Assigner (Admin, Superfranchisee, or Franchisee)
    //     price: Number, // Price set during assignment
    //     commission: Number, // Commission for the assigner
    //     assignedAt: { type: Date, default: Date.now }, // Timestamp
    //   },
    // ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

packageSchema.index({ packageName: 1 });
packageSchema.index({ tenantId: 1, packageName: 1 });
packageSchema.index({ createdBy: 1, createdAt: -1 });

const Package = mongoose.model("Package", packageSchema);

export { Package };
