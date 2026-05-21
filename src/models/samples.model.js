import mongoose, { Schema } from "mongoose"

const barcodeSchema = new Schema({
    barcode: {
        type: String
    },
    testandpannelArray: {
        type: Array
    },
    sampleType: {
        type: String
    },
    testIds: [
        {
            id: {
                type: mongoose.Types.ObjectId
            },
            collectionName: String
        },
    ]
},
    { timestamps: true } // Enable createdAt and updatedAt
)
const pannelSchema = new Schema({
    tenantId: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    bookingId: {
        type: String,
    },
    barcodes: [barcodeSchema]
},
    { timestamps: true }
)

pannelSchema.index({ tenantId: 1, bookingId: 1 });
pannelSchema.index({ tenantId: 1, "barcodes.barcode": 1 });
pannelSchema.index({ "barcodes.barcode": 1, updatedAt: -1 });

const acceptedBarcode = mongoose.model("acceptedBarcode", pannelSchema)

export { acceptedBarcode }
