import mongoose, { Schema } from "mongoose"

const tableSchema = new Schema({
    typeOfSample: {
        type: String
    },
    barcodeId: {
        type: String,
        required: true
    },
    testName: {
        type: String
    },
    ids: [
        {
            id: {
                type: mongoose.Types.ObjectId
            },
            collectionName: String
        },
    ]
})

const TestBookingSchema = new Schema({
    bookingId: {
        type: String,
        unique: true,
        required: true
    },
    date: {
        type: Date
    },
    time: {
        type: String
    },
    courierName: {
        type: String
    },
    courierId: {
        type: String
    },
    patientName: {
        type: String,
        required: true
    },
    year: {
        type: String
    },
    gender: {
        type: String,
        required: true
    },
    patientPhone: {
        type: String,
    },
    doctorName: {
        type: String
    },
    labName: {
        type: String
    },
    franchisee: {
        type: String
    },
    clinicalHistory: {
        type: String
    },
    file: {
        type: String
    },
    editHistory: [
        {
            fieldName: String,              // kaunsi field change hui
            oldValue: mongoose.Schema.Types.Mixed, // pehle kya tha
            newValue: mongoose.Schema.Types.Mixed, // ab kya hai
            editedById: { type: Schema.Types.ObjectId, ref: 'User' },
            editedByName: String,
            editedAt: { type: Date, default: Date.now }
        }
    ],
    tableData: [tableSchema],
    total: {
        type: Number,
        required: true
    },
    subFranchisee: {
        type: String
    },
    subFranchiseeId: {
        type: Schema.Types.ObjectId
    },
    savedDoctor: {
        type: String
    },
    savedDoctorId: {
        type: Schema.Types.ObjectId
    },
    savedLab: {
        type: String
    },
    savedLabId: {
        type: Schema.Types.ObjectId
    },
    status: {
        type: String,
        default: 'On Hold'
    },
    statusHistory: [{
        previousStatus: { type: String, required: true },
        newStatus: { type: String, required: true },
        reason: { type: String, required: true, trim: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        changedByRole: { type: String },
        changedAt: { type: Date, default: Date.now },
        requestId: { type: String },
    }],
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String, trim: true },
    isreportready: {
        type: Boolean,
        default: false
    },
    discountamount: {
        type: Number,
        default: 0
    },
    discountunit: {
        type: Number,
        default: 0
    },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference to the creator
    createdbyuser: { type: String, ref: 'User' }, // Reference to the creator
    commissions: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            role: { type: String, enum: ['superFranchisee', 'franchisee', 'subFranchisee'] },
            amount: { type: Number },
            createdAt: { type: Date, default: Date.now },
        },
    ],
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
})

TestBookingSchema.index({ tenantId: 1, bookingId: 1 }, { unique: true });
TestBookingSchema.index({ tenantId: 1, createdBy: 1, createdAt: -1 });
TestBookingSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
TestBookingSchema.index({ tenantId: 1, status: 1, date: -1 });
TestBookingSchema.index({ tenantId: 1, patientPhone: 1, createdAt: -1 });
TestBookingSchema.index({ tenantId: 1, savedDoctorId: 1, createdAt: -1 });
TestBookingSchema.index({ tenantId: 1, savedLabId: 1, createdAt: -1 });
TestBookingSchema.index({ tenantId: 1, "tableData.barcodeId": 1 });
TestBookingSchema.index({ tenantId: 1, date: -1, createdAt: -1 });
TestBookingSchema.index({ tenantId: 1, date: 1 });
TestBookingSchema.index({ tenantId: 1, patientName: 1, createdAt: -1 });
TestBookingSchema.index({ createdAt: -1 });

const newBooking = mongoose.model("testBooking", TestBookingSchema)

export { newBooking }
