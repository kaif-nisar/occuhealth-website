import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      trim: true
    },
    address1: {
      type: String,
      trim: true
    },
    address2: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    pincode: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      default: 'India'
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      default: ''
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true // Adds createdAt & updatedAt automatically
  }
);

export const Address = mongoose.model('Address', addressSchema);
