import multer from 'multer';

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // You might want to change this to a temporary directory
        // or a specific upload folder. For Cloudinary, a local temp path is fine.
        cb(null, './public/temp');
    },
    filename: function (req, file, cb) {
        // Use original filename or generate a unique one
        cb(null, file.originalname);
    }
});

// Create the multer upload instance
const upload = multer({
    storage: storage,
});

export { upload };