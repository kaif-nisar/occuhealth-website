import express from "express";
import { verifyJWT } from "../../middlewares/auth.middleware.js";
import { checkStaffPermission } from "../../middlewares/role.middleware.js";
import { bulkAutoFinalizeController } from "../controllers/bulkBooking.controller.js";

const router = express.Router();

router.post(
    "/auto-finalize",
    verifyJWT,
    checkStaffPermission("canManageBookings"),
    bulkAutoFinalizeController
);

export default router;
