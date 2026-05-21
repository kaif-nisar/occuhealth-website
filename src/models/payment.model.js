import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  razorpay_order_id: { type: String, index: true },
  razorpay_payment_id: { type: String, index: true },
  razorpay_signature: String,
  amount: Number, // in INR
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['created','paid','failed'], default: 'created' },
  for: { type: String }, // e.g., 'tenant_signup', 'subscription'
  refId: { type: mongoose.Schema.Types.ObjectId }, // e.g., tenantId or userId
  meta: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

export const Payment = mongoose.model('Payment', paymentSchema);
