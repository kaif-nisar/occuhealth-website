import mongoose, { Schema } from "mongoose"

const counterSchema = new Schema({
    _id: {
        type: String,
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    sequence_value: {
        type: Number,
    },
    
})

const category = new Schema({
    orderId: {
        type: Number,
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
        default: null
    },
    category: {
        type: String,
        required: true
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference to the creator
    isBaseCategory: {
        type: Boolean,    // True if created by SuperAdmin as a template   
        default: true,
    },
    purchasedFromBaseCategory: {
        type: Boolean,   // If this category was rented/purchased from the SuperAdmin
        default: false,
        index: true,    // For faster queries
    },
    originalCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "categorydb"   // Reference to original category if purchased/rented
    },
    createdByRole: {
        type: String,
        enum: ["superAdmin", "admin"],   // Role of the user who created the category
    },

})


const unit = new Schema({
    unit: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference to the creator
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
        default: null
    },
    isBaseUnit: {
        type: Boolean,    // True if created by SuperAdmin as a template   
        default: false,
    },
    purchasedFromBaseUnit: {
        type: Boolean,   // If this unit was rented/purchased from the SuperAdmin
        default: false,
        index: true,    // For faster queries
    },
    originalUnitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "unitdb"   // Reference to original unit if purchased/rented
    },
    createdByRole: {
        type: String,
        enum: ["superAdmin", "admin"],   // Role of the user who created the unit
    },
    
})

const unitdb = mongoose.model('unitdb', unit);

counterSchema.index({ tenantId: 1, createdBy: 1 });
category.index({ tenantId: 1, createdBy: 1, orderId: 1 });
category.index({ tenantId: 1, category: 1 });
unit.index({ tenantId: 1, createdBy: 1, unit: 1 });

const categorydb = mongoose.model("categorydb", category)
const Counter = mongoose.model("counter", counterSchema)

export { Counter, categorydb, unitdb }
