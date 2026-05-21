import { customization } from "../models/printsetting.model.js";

const cleanupCustomizationsOnStartup = async () => {
    try {
        const now = new Date();
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - 2);

        console.log("[Customization Cleanup] Tenant-wise cleanup started");
        console.log(`[Customization Cleanup] Current time: ${now.toISOString()}`);
        console.log(`[Customization Cleanup] Deleting records created before: ${cutoffDate.toISOString()}`);

        const deleteFilter = {
            tenantId: { $exists: true, $ne: null },
            $or: [
                { isDocumented: false },
                { isdocumented: false }
            ],
            createdAt: { $lt: cutoffDate }
        };

        const totalMatched = await customization.countDocuments(deleteFilter);
        const deleteResult = totalMatched > 0
            ? await customization.deleteMany(deleteFilter)
            : { deletedCount: 0 };
        const totalDeleted = deleteResult.deletedCount || 0;

        console.log(`[Customization Cleanup] Total matched count: ${totalMatched}`);
        console.log(`[Customization Cleanup] Total deleted count: ${totalDeleted}`);
        console.log("[Customization Cleanup] Tenant-wise cleanup completed");
    } catch (error) {
        console.error("[Customization Cleanup] Cleanup failed:", error.message);
    }
};

export { cleanupCustomizationsOnStartup };
