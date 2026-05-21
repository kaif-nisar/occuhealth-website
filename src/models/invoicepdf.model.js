import mongoose, {Schema} from "mongoose"

const invoiceSchema = new Schema({
    tenantId: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    invoiceCss: {
        type: String,
    },
    invoiceHtml: {
        type: String,
    },
    billNumber: {
        type: String,
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
    },
    billingPrice: {
        type: Number
    },
    bookingId: String
}, {
    timestamps: true
});

const invoices = mongoose.model("invoice", invoiceSchema)

export {invoices}