import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        skuId: {
            type: String,
            unique: true,
            uppercase: true,
        },
        description: {
            type: String,
        },
        category: {
            type: String,
        },
        status: {
            type: String,
            enum:["Active", "Inactive"],
            default: "Active"
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        discountPrice: {
            type: Number,
            min: 0,
            validate: {
                validator: function (v) {
                    return v <= this.price;
                },
                message: "Discount price can't be more than the original price",
            },
        },
        stock: {
            type: Number,
            required: true,
            min: 0,
        },
        weight: {
            type: Number, // in grams or kg
            min: 0,
        },
        dimensions: {
            length: { type: Number, min: 0 },
            width: { type: Number, min: 0 },
            height: { type: Number, min: 0 },
            unit: {
                type: String,
                enum: ['cm', 'mm', 'inch'],
                default: 'cm',
            },
        },
        mainImage: {
            url: { type: String, required: true },
            public_id: { type: String, required: true },
        },
        additionalImages: [
            {
                url: String,
                public_id: String,
            },
        ],
        isActive: {
            type: Boolean,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        taxrate: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

export const Product = mongoose.model('Product', productSchema);
