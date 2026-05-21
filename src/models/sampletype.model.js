import mongoose, { Schema } from "mongoose";

const sample = new Schema(
   {
    Name: {
        type: String,
    },
    createdBy: Object,
    tenantId: {
      type: mongoose.Types.ObjectId,
      ref: "Tenant"
    },
    isBaseSample:{
      type: Boolean,
      default: true  
    },
    originalSampleId:{
      type: mongoose.Types.ObjectId,
      ref: "sampleType"
    },
    purchasedFromBaseSample:{
      type: Boolean,
      default: false  
    },
    createdByRole: {
      type: String,
      enum: ["superAdmin", "admin"]
    } 
   },
  {
    timestamps: true,
  }
);

sample.index({ createdBy: 1, Name: 1 });
sample.index({ tenantId: 1, Name: 1 });
sample.index({ createdBy: 1, createdAt: -1 });
sample.index({ tenantId: 1, createdAt: -1 });

// Create the model
const sampleSchema = mongoose.model("sampleType", sample);

export { sampleSchema };
