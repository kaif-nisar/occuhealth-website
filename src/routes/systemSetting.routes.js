import { Router } from "express";
import { getSettings, togglePaymentGateway } from "../controllers/systemSetting.controller.js";
import { verifySuperAdmin } from "../../middlewares/superAdminMiddleware.js";

const router = Router();

router.route("/").get(getSettings);
router.route("/toggle-payment-gateway").put(verifySuperAdmin, togglePaymentGateway);

export default router;
