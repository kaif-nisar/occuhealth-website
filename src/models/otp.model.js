import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  identifier: { type: String, required: true }, // email or phone
  codeHash: { type: String, required: true },
  purpose: { type: String, default: 'signup' },
  verified: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  resendCount: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  consumedAt: { type: Date },
  expiresAt: { type: Date, required: true },
  meta: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

otpSchema.index({ identifier: 1, purpose: 1, createdAt: -1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTP = mongoose.model('OTP', otpSchema);
