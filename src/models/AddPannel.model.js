import mongoose, { Schema } from "mongoose";

const pannelSchema = new Schema(
  {
    order: {
      type: Number,
      default: 1,
    },
    name: {
      type: String,
      required: true,
    },
    category: {
      type: Object,
    },
    price: {
      type: Number,
    },
    final_price: {
      type: Number,
    },
    tests: [
      {
        type: String,
        required: true,
      },
    ],
    testsId: [
      {
        type: mongoose.Types.ObjectId,
        ref: "testSchema",
        required: true,
      },
    ],
    interpretation: {
      type: String,
    },
    assignedPrices: [
      {
        userId: mongoose.Schema.Types.ObjectId, // Assignee (Franchisee or Subfranchisee)
        assignedBy: mongoose.Schema.Types.ObjectId, // Assigner (Admin, Superfranchisee, or Franchisee)
        price: Number, // Price set during assignment
        commission: Number, // Commission for the assigner
        assignedAt: { type: Date, default: Date.now }, // Timestamp
      },
    ],
    sample_types: [
      {
        type: String,
        required: true,
      },
    ],
    hideInterpretation: {
      type: Boolean,
      default: false,
    },
    hideMethodInstrument: {
      type: Boolean,
      default: false,
    },
    // Multi-tenant fields

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
    isBasePanel: {
      type: Boolean,
      default: false, // True if created by SuperAdmin as a template
    },

    // If this test was rented/purchased from the SuperAdmin
    purchasedFromBasePanel: {
      type: Boolean,
      default: false,
      index: true, // For faster queries
    },

    // Reference to original test if purchased/rented
    originalPanelId: {
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

pannelSchema.index({ name: 1, tenantId: 1 }, { unique: true });
pannelSchema.index({ name: 1, sample_types: 1 });
pannelSchema.index({ createdBy: 1, order: -1 });
pannelSchema.index({ tenantId: 1, order: -1 });

const addPannel = mongoose.model("pannel", pannelSchema);

export { addPannel };
