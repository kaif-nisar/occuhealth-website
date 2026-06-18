import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
    // ... other controllers
    bulkBookingsController,
    // ... other controllers
} from '../controllers/NewBooking.controller.js';

const router = Router();

router.use(verifyJWT); // Apply JWT verification to all routes below

// Add this line to define the bulk booking route
router.route("/bulk-booking-auto-finalize").post(bulkBookingsController);

export default router;