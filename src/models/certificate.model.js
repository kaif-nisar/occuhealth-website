import mongoose, {Schema} from "mongoose"

const certificateSchema = new Schema({
    pdfHtml: {
        type: String,
    },
    pdfcss: {
        type: String,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
    }
}, {
    timestamps: true
});

const certificates = mongoose.model("certificateSchema", certificateSchema)

export {certificates}