import { Router } from "express";
import {
    getSalesHierarchy,
    getSalesBusinessAnalytics,
    getAvailableDownlines,
    getMySalesFranchisees,
    getSalesBookings,
    checkSalesReportEligibility,
    assignSalesTarget,
    getAllSalesStaff
} from "../controllers/sales.controller.js";
import { verifyJWT } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, checkStaffPermission } from "../../middlewares/role.middleware.js";

const router = Router();

// All sales routes require authentication
router.use(verifyJWT);

// Get current sales hierarchy tree and profile
router.get("/hierarchy", getSalesHierarchy);

// Get rich business analytics (revenue, targets, tubes, samples, timeline, downline table)
router.get("/business-analytics", getSalesBusinessAnalytics);

// Get available downlines for creation / assignment dropdowns
router.get("/downline-options", getAvailableDownlines);

// Get accessible franchisees list for booking dropdown & filters
router.get("/my-franchisees", getMySalesFranchisees);

// Get patient bookings under tagged franchisees
router.get("/bookings", getSalesBookings);

// Pre-flight check for report download eligibility (gated by positive wallet balance)
router.get("/check-report-eligibility/:bookingId", checkSalesReportEligibility);

// Assign or update monthly sales quota / target
router.post(
    "/assign-target",
    authorizeRoles(["admin", "superFranchisee", "staff"]),
    assignSalesTarget
);

// Get all sales personnel list
router.get(
    "/all-sales-staff",
    authorizeRoles(["admin", "superFranchisee", "staff"]),
    getAllSalesStaff
);

export default router;

