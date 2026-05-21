import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  identifier: { type: String, required: true }, // email or phone
  code: { type: String, required: true },
  purpose: { type: String, default: 'signup' },
  verified: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  meta: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

otpSchema.index({ identifier: 1, purpose: 1 });

export const OTP = mongoose.model('OTP', otpSchema);
