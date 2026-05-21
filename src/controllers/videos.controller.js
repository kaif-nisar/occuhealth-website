import { videos } from "../models/video.model.js"

const addvideo = async (req, res) => {
    const userId = req.user._id;
    try {
        const { title, youtubeUrl, thumbnail } = req.body;

        if (!title || !youtubeUrl || !thumbnail) {
            return res.status(400).json({ message: "please fill all required feilds" })
        }
        const video = await videos.create({
            title,
            createdBy: userId,
            youtubeUrl,
            thumbnail
        });

        if (!video) {
            return res.status(500).json({ message: "video not saved ! please try again" })
        }
        res.status(201).json({ success: true, video, message: "video uploaded successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

const deletevideo = async (req, res) => {
    try {
        if (req.user.role !== "superAdmin") {
            return res.status(450).json({ success: false, message: "! You are not authorized to delete videos" });
        }
        const deleted = await videos.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Video not found" });
        }
        res.status(200).json({ success: true, message: "Video deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

const getAllVideos = async (req, res) => {

    try {
        const videosList = await videos.find({}).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            videos: videosList,
            message: "All videos fetched successfully"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch videos",
            error: err.message
        });
    }
};


export {
    addvideo,
    getAllVideos,
    deletevideo
}