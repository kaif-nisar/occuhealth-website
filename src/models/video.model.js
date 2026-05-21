import mongoose from "mongoose";

const videoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    youtubeUrl: { type: String, required: true },
    thumbnail: { type: String },
    createdAt: { type: Date, default: Date.now },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    }
});

const videos = mongoose.model('Video', videoSchema);

export {videos}
