import mongoose, { Schema } from "mongoose"

const tabledataSchema = new Schema({
    reference: String,
    testName: String,
    unit: String,
    value: String,
    remark: String,
    details: String,
    isDocumented: {
        type: Boolean,
        default: false
    },
    pagebreak:{
        type: Boolean,
        default: false
    }
})

const categoryAndTestSchema = new Schema({
    category: String,
    advice: String,
    interpretation: String,
    notes: String,
    remarks: String,
    title: String,
    tests: [tabledataSchema]
})

const reportData = new Schema({
    tenantId: {
        type: mongoose.Types.ObjectId
    },
    createdBy: {
        type: mongoose.Types.ObjectId
    },
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
        required: true
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
    reg_id: {
        type: String
    },
    signedBy: {
        type: String
    },
    CategoryAndTest: [categoryAndTestSchema],
    collectedOn: String,
    receivedOn: String,
    reportedOn: String,
    categorizedPDF: Boolean,
    MoreDetails: String,
    uniquetestArray: [String],
    signOff: {
        type: Boolean,
        default: false
    },
    isdocumented : {
        type: Boolean,
        default: false
    },
},
    { timestamps: true }
)

reportData.index({ tenantId: 1, bookingId: 1 }, { unique: true });
reportData.index({ tenantId: 1, status: 1, createdAt: -1 });
reportData.index({ tenantId: 1, patientPhone: 1 });
reportData.index({ tenantId: 1, createdBy: 1, createdAt: -1 });

const reports = mongoose.model("report", reportData);

export { reports };

