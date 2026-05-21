// tenantContextMiddleware.js
import { asyncHandler } from "../src/utils/asyncHandler.js";
import { Tenant } from "../src/models/tenant.model.js";

export const setTenantContext = asyncHandler(async (req, res, next) => {
    const { tenantId } = req.params;

    if (!tenantId) {
        return res.status(400).json({
            success: false,
            message: "Tenant ID is required"
        });
    }

    const tenant = await Tenant.findById(tenantId);
    
    if (!tenant) {
        return res.status(404).json({
            success: false,
            message: "Tenant not found"
        });
    }

    if (tenant.status !== 'active') {
        return res.status(403).json({
            success: false,
            message: "Tenant is not active"
        });
    }

    req.tenantInfo = tenant;
    next();
});