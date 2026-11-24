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
      default: false,
    },
    HighLow: {
      type: Boolean,
      default: true,
    },
    RowSpacing: {
      type: Number,
      default: 3,
    },
    selectedFontSize: {
      type: Number,
      default: 10,
    },
    headerContentGap: {
      type: Number,
      default: 1,
    },
    showCategory: {
      type: Boolean,
      default: true,
    },
    showTestHeading: {
      type: Boolean,
      default: true,
    },
    // NABL Accreditation Logo Position & Size Settings
    nablLogoWidth: {
      type: Number,
      default: 30, // Width in mm (~85 pt)
    },
    nablLogoHeight: {
      type: Number,
      default: 18, // Height in mm (~50 pt)
    },
    nablLogoX: {
      type: Number,
      default: 170, // X position in mm from left edge
    },
    nablLogoY: {
      type: Number,
      default: 5, // Y position in mm from top edge
    },
    nablLogoPosition: {
      type: String,
      default: "top-right", // Preset: 'top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left', 'custom'
    },
    nablLogoPageOption: {
      type: String,
      default: "all-pages", // 'all-pages' or 'first-page'
    },
    nablLogoVisible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const defaultpdfsetting = mongoose.model("defaultSettings", customizationSchema);

export {defaultpdfsetting}
