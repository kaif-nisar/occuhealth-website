import { Router } from 'express';
import {
    assignTarget,
    getTargets,
    getFranchiseePerformance,
    updateTargetAchievement,
    getTargetAnalytics,
    getCurrentMonthTarget
} from '../controllers/target.controller.js';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { authorizeRoles, checkStaffPermission } from '../../middlewares/role.middleware.js';

const router = Router();

// All routes are protected and require authentication
router.use(verifyJWT);

// Assign or update target (Admin & SuperFranchisee only)
router.post(
    '/assign-target',
    authorizeRoles(['admin', 'superFranchisee', 'staff']),
    checkStaffPermission('canManagePayments'),
    assignTarget
);

// Get targets for a month
router.post('/get-targets', getTargets);

// Get franchisee performance history
router.get(
    '/performance/:franchiseeId/:months?',
    getFranchiseePerformance
);

// Update target achievement (Called by booking system)
router.post(
    '/update-achievement',
    authorizeRoles(['admin', 'superFranchisee', 'franchisee', 'staff']),
    checkStaffPermission('canManageBookings'),
    updateTargetAchievement
);

// Get target analytics (Admin & SuperFranchisee only)
router.get(
    '/analytics',
    authorizeRoles(['admin', 'superFranchisee', 'staff']),
    checkStaffPermission('canViewReports'),
    getTargetAnalytics
);
// Get current month target for logged-in franchisee
router.get(
    '/targets/current',
    authorizeRoles(['franchisee', 'superFranchisee','subFranchisee', 'staff']),
    getCurrentMonthTarget
);

export default router;