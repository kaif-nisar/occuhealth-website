import mongoose, { Schema } from 'mongoose';

const ledgerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, index: true }, // For faster user-based queries
    role: {
        type: String,
        enum: ['superAdmin', 'staff', 'admin', 'superFranchisee', 'franchisee', 'subFranchisee'],
        index: true // For role-based revenue analysis
    },
    transactionId: { type: String, required: true, index: true }, // Unique index automatically
    amount: { type: Number, required: true },
    type: {
        type: String,
        enum: ['credit', 'debit', 'assignment'],
        required: true,
        index: true // Critical for revenue queries (filtering by credit)
    },
    balanceAfterTransaction: { type: Number },
    description: { type: String },
    remarks: { type: String },
    assignment: {
        testCount: { type: Number, default: 0 },
        panelCount: { type: Number, default: 0 },
        packageCount: { type: Number, default: 0 },
        totalPrice: { type: Number, default: 0 },
    },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
    testName: { type: String },
    receivedFrom: { type: String },
    paymentMethod: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    razorpayOrderId: { type: String, index: true },
    walletType: {
        type: String,
        enum: ['bookingWallet', 'commissionWallet', 'subscription', 'system'],
        index: true
    },
    commission: {
        amount: { type: Number },
        fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        fromUserRole: { type: String, enum: ['superFranchisee', 'franchisee', 'subFranchisee'] },
        toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        toUserRole: { type: String, enum: ['superFranchisee', 'franchisee', 'subFranchisee'] },
    },
    testDetails: [
        {
            testName: String,
            testPrice: Number,
            commissionAmount: Number,
        }
    ],
    sampleBarcodeId: [String],
    patientName: { type: String },
    createdAt: { type: Date, default: Date.now, index: true }, // Critical for time-based queries
    updatedAt: { type: Date, default: Date.now },
    discountamount: {
        type: Number,
        default: 0
    },
    discountunit: {
        type: Number,
        default: 0
    },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'testBooking'}
}
, { timestamps: true }
);

// Compound Indexes for optimized revenue queries
ledgerSchema.index({ type: 1, createdAt: -1 }); // Most important for revenue queries
ledgerSchema.index({ type: 1, role: 1, createdAt: -1 }); // For role-based revenue analysis
ledgerSchema.index({ userId: 1, type: 1, createdAt: -1 }); // For user-specific revenue
ledgerSchema.index({ createdAt: -1, type: 1, amount: 1 }); // For time-based amount queries

// Text index for searching descriptions (optional)
ledgerSchema.index({ description: "text", remarks: "text" });

export const Ledger = mongoose.model('Ledger', ledgerSchema);
