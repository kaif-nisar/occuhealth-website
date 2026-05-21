import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    title: String,
    price: Number,
    quantity: Number,
    taxrate: Number,
    image: String,
    brand: String
}, { _id: false });

const addressSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    address1: String,  // (was 'street')
    address2: String,  // (was 'street')
    city: String,
    state: String,
    pincode: String,
    phone: String
}, { _id: false });

const invoicePaymentSchema = new mongoose.Schema({
    invoiceId: { type: String, unique: true },
    date: String,
    products: [productSchema],
    tax: Number,
    total: Number,
    address: addressSchema,
    tenantId: {
        type: mongoose.Types.ObjectId,
        ref: "User"
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: "User"
    },
    timestamp: { type: Date, default: Date.now },
    orderStatus: {
        type: String,
        default: "pending",
        enum: ["pending", "processing", "shipped", "delivered", "cancelled"]
    },
    trackingId: { type: String, default: "" },
    courierName: { type: String, default: "" },
    message: { type: String, default: "" }
}, {
    timestamps: true,           // ✅ Automatically adds createdAt and updatedAt
});

export const orders = mongoose.model("order", invoicePaymentSchema);
