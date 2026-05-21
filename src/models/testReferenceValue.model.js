import mongoose, { Schema } from "mongoose";

const testReferenceValueSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    testId: {
      type: Schema.Types.ObjectId,
      ref: "testSchema",
      default: null,
      index: true,
    },
    parameterId: {
      type: Schema.Types.ObjectId,
      index: true,
      default: null,
    },
    valueName: {
      type: String,
      required: true,
      trim: true,
    },
    isAbnormal: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

testReferenceValueSchema.index(
  { tenantId: 1, valueName: 1 },
  { unique: true, partialFilterExpression: { valueName: { $exists: true } } }
);

const TestReferenceValue =
  mongoose.models.TestReferenceValue ||
  mongoose.model("TestReferenceValue", testReferenceValueSchema);

export { TestReferenceValue };
