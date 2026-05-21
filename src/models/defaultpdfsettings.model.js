import mongoose from "mongoose";

const customizationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant", // Tenant collection reference
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // User collection reference
      required: true,
    },
    headermargin: {
      type: String,
      default: "2.8",
    },
    footermargin: {
      type: String,
      default: "1",
    },
    marginRight: {
      type: String,
      default: "0",
    },
    marginLeft: {
      type: String,
      default: "0",
    },
    investigationmargin: {
      type: Number,
      default: 40,
    },
    showInvest: {
      type: Boolean,
      default: true,
    },
    BoldRow: {
      type: Boolean,
      default: true,
    },
    HLinred: {
      type: Boolean,
      default: true,
    },
    HighLow: {
      type: Boolean,
      default: true,
    },
    RowSpacing: {
      type: Number,
      default: 7,
    },
    selectedFontSize: {
      type: Number,
      default: 12,
    },
  },
  {
    timestamps: true,
  }
);

const defaultpdfsetting = mongoose.model("defaultSettings", customizationSchema);

export {defaultpdfsetting}
