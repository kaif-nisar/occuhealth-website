import mongoose from 'mongoose'

const templateSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Types.ObjectId,
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
    },
    template: {
        type: String,
        required: true,
    },
    public_id: String
});

const Template = mongoose.model('Template', templateSchema);
export {Template}
