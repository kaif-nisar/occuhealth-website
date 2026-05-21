import mongoose from "mongoose";

const targetSchema = new mongoose.Schema({
    franchiseeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fullName:{
        type: String,
        required: true,
    },
    month: {
        type: String, // Format: YYYY-MM
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    achieved: {
        type: Number,
        default: 0,
        min: 0
    },
    remarks: {
        type: String,
        trim: true
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'achieved', 'failed'],
        default: 'pending'
    },
    history: [{
        date: {
            type: Date,
            default: Date.now
        },
        amount: Number,
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking'
        },
        description: String
    }],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create compound index for unique monthly targets per franchisee
targetSchema.index({ franchiseeId: 1, month: 1, tenantId: 1 }, { unique: true });

// Method to update achieved amount
targetSchema.methods.updateAchieved = async function(bookingAmount, bookingId) {
    this.achieved += bookingAmount;
    this.history.push({
        amount: bookingAmount,
        bookingId: bookingId,
        description: 'Booking completed'
    });
    
    // Update status based on achievement
    if (this.achieved >= this.amount) {
        this.status = 'achieved';
    }
    
    this.lastUpdated = new Date();
    await this.save();
};

// Static method to get all targets for a tenant
targetSchema.statics.getTenantTargets = async function(tenantId, month) {
    return this.find({ 
        tenantId,
        month: month || new Date().toISOString().slice(0, 7)
    })
    .populate('franchiseeId', 'username fullName')
    .populate('assignedBy', 'username fullName')
    .sort('-createdAt');
};

// Static method to get franchisee performance
targetSchema.statics.getFranchiseePerformance = async function(franchiseeId, months = 6) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);
    
    return this.find({
        franchiseeId,
        createdAt: { $gte: startDate }
    })
    .select('month amount achieved status')
    .sort('month');
};

export const Target = mongoose.model('Target', targetSchema);