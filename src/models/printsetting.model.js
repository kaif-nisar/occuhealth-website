import mongoose, { Schema } from "mongoose";

const customizationSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    bookingId: {
        type: String,
        default: ""
    },
    DownloadPdf: {
        type: Boolean,
        default: false
    },
    showInvest: {
        type: Boolean,
        default: true
    },
    BoldRow: {
        type: Boolean,
        default: true
    },
    HLinred: {
        type: Boolean,
        default: false
    },
    HighLow: {
        type: Boolean,
        default: true
    },
    RowSpacing: {
        type: Number,
        default: 7
    },
    selectedFontSize: {
        type: Number,
        default: 12
    },
    reportId: {
        type: Schema.Types.ObjectId
    },
    htmlContent: String, // Save only the path of the generated PDF
    cssContent: String,
    header: String,
    footer: String,
    backgroundImageUrl: String,  // Path to the saved PDF
    headermargin: {
        type: String,
        default: "2.8"
    },
    footermargin: {
        type: String,
        default: "1"
    },
    marginRight: {
        type: String,
        default: "0"
    },
    marginLeft: {
        type: String,
        default: "0"
    },
    investigationmargin: {
        type: Number,
        default: 1
    },
    showlab:{
        type: Boolean,
        default: false
    },
    showdoctorfirst:{
        type: Boolean,
        default: true
    },
    showdoctorsecond:{
        type: Boolean,
        default: true
    },
    fileInputLab:{
        type: String,
        default: ""
    },
    fileInputDoctorleft:{
        type: String,
        default: ""
    },
    fileInputDoctorright:{
        type: String,
        default: ""
    },
    fileInputLabtext:{
        type: String,
        default: ""
    },
    fileInputDoctorlefttext:{
        type: String,
        default: ""
    },
    fileInputDoctorrighttext:{
        type: String,
        default: ""
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    isdocumented : {
        type: Boolean,
        default: false
    },
    format: {
        type: String,
        default: ""
    },
    attachments: [
        {
            url: String,
            publicId: String,
            fileType: { type: String, enum: ['image', 'pdf'] },
            fileName: String,
            order: { type: Number, default: 0 },
            uploadedAt: { type: Date, default: Date.now }
        }
    ],
},
    { timestamps: true }
);

customizationSchema.index({ reportId: 1 }, { sparse: true });
customizationSchema.index({ tenantId: 1, bookingId: 1 });
customizationSchema.index({ tenantId: 1, createdAt: -1 });
customizationSchema.index({ tenantId: 1, isdocumented: 1, createdAt: -1 });

const customization = mongoose.model('Customization', customizationSchema);

export { customization }
