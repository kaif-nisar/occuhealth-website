import mongoose,{Schema} from "mongoose";

const priceAssignmentSchema = new mongoose.Schema({
        testName:{type:String},
        testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true }, // Test or Panel ID
        franchiseeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Assigned Franchisee
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Admin/SuperFranchisee
        testType: { type: String, enum: ['test', 'panels', 'package'], required: true }, // What type of test it is
        assignedPrice: { type: Number, required: true }, // Price assigned to franchisee
        finalPrice: { type: Number, required: true }, // Customer Price (MRP)
        tat:{type:String},
        remarks: { type: String }, // Optional remarks for assignment
        createdAt: { type: Date, default: Date.now }
    
});

export const PriceAssignment = mongoose.model('PriceAssignment', priceAssignmentSchema);