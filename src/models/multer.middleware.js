import multer from 'multer';
import { mkdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

const TEMP_UPLOAD_DIR = path.resolve('public', 'temp');

// Ensure the temp upload directory exists before multer starts writing files.
mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use an absolute temp directory so uploads work consistently on mobile and desktop.
        cb(null, TEMP_UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        const originalName = String(file.originalname || 'upload');
        const extension = path.extname(originalName);
        const baseName = path
            .basename(originalName, extension)
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .slice(0, 80) || 'upload';

        // Generate a unique temp filename so multiple mobile files never overwrite each other.
        const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        cb(null, `${baseName}-${uniqueSuffix}${extension}`);
    }
});

// Create the multer upload instance
const upload = multer({
    storage: storage,
});

export { upload };
