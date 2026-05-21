import mongoose from 'mongoose';

const doctorsignSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Types.ObjectId,
        ref:"User"
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: "User"
    },
    showlabinchargesign: {
        type: Boolean,
        default: true
    },
    labinchargesign: {
        type: String,
        required: true,
    },
    labinchargesignpublicid: String,
    labinchargeinfo: {
        type: String
    },
    showfirstdoctorsign: {
        type: Boolean,
        default: true
    },
    firstdoctorsign: {
        type: String,
        required: true,
    },
    firstdoctorsignpublicid: String,
    firstdoctorsigninfo: {
        type: String
    },
    showseconddoctorsign: {
        type: Boolean,
        default: true
    },
    seconddoctorsign: {
        type: String,
        required: true,
    },
    seconddoctorsignpublicid: String,
    seconddoctorsigninfo: {
        type: String
    }
},
{
    timestamps: true
}
);

const doctorsign = mongoose.model('doctorsign', doctorsignSchema);
export {doctorsign}