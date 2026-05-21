import mongoose, {Schema} from "mongoose"

const doctorSchema = new Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    specialization: {
        type: String,
        required: true
    },
    DOB: {
        type: Date,
    },
    gender: {
        type: String,
        enum: ["male", "female", "other"],
        required: true
    },
    remarks: {
        type: String,
        default: ""
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant', // Reference to the tenant
        required: true
    },
    address: {
        type: String
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference to the creator
}, {
    timestamps: true
});

doctorSchema.index({ tenantId: 1, createdBy: 1, createdAt: -1 });
doctorSchema.index({ tenantId: 1, firstName: 1, lastName: 1 });

const doctors = mongoose.model("doctor", doctorSchema)

export {doctors}
