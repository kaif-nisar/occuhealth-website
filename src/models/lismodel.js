import mongoose, {Schema} from "mongoose"

const lisschema = new Schema({
    lisData: {
        type: Object,
        default: null
    }
}, {
    timestamps: true
});

lisschema.index({ "lisData.sample_id": 1 });

const lisdata = mongoose.model("lisdata", lisschema)

export {lisdata}
