import mongoose, { Schema } from "mongoose";

const systemSettingSchema = new Schema({
    isPaymentGatewayEnabled: {
        type: Boolean,
        default: true,
    },
    lastUpdatedBy: {
        type: String,
        default: "System",
    },
    lastUpdatedTime: {
        type: Date,
        default: Date.now,
    }
}, {
    timestamps: true,
});

export const SystemSetting = mongoose.model("SystemSetting", systemSettingSchema);
