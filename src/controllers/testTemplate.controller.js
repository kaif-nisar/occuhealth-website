import mongoose from "mongoose";
import { testTemplate } from "../models/testTemplate.model.js";

function resolveTemplateActor(user = {}) {
    const tid = user?.tenantId?._id || user?.tenantId || null;
    const uid = user?._id || null;
    const isTenantLabOperator =
        user?.role === "admin" ||
        (user?.role === "staff" && user?.parentRole === "admin");

    return { tid, uid, isTenantLabOperator };
}

const saveTestTemplate = async (req, res) => {
    try {
        const { testId, templateName, content } = req.body || {};
        const { tid, uid } = resolveTemplateActor(req.user);

        const cleanTestId = String(testId || "").trim();
        const cleanTemplateName = String(templateName || "").trim();
        const cleanContent = String(content || "").trim();

        if (!tid || !uid) {
            return res.status(401).json({ message: "Unauthorized request." });
        }

        if (!cleanTestId || !cleanTemplateName || !cleanContent) {
            console.error("Missing required fields");
            return res.status(400).json({ message: "testId, templateName, and content are required fields." });
        }

        if (!mongoose.Types.ObjectId.isValid(cleanTestId)) {
            return res.status(400).json({ message: "Invalid testId." });
        }

        // Check if a document with the given testId exists for this user and tenant
        let templateDoc = await testTemplate.findOne({
            testId: cleanTestId,
            tenantId: tid,
            createdBy: uid
        });

        let actionMessage = "Template saved successfully.";

        if (templateDoc) {
            const existingIndex = (templateDoc.templates || []).findIndex(
                (t) => String(t?.templateName || "").trim().toLowerCase() === cleanTemplateName.toLowerCase()
            );

            if (existingIndex >= 0) {
                templateDoc.templates[existingIndex].templateName = cleanTemplateName;
                templateDoc.templates[existingIndex].content = cleanContent;
                actionMessage = "Template updated successfully.";
            } else {
                templateDoc.templates.push({
                    templateName: cleanTemplateName,
                    content: cleanContent,
                });
            }
        } else {
            templateDoc = new testTemplate({
                tenantId: tid,
                createdBy: uid,
                testId: cleanTestId,
                templates: [{
                    templateName: cleanTemplateName,
                    content: cleanContent,
                }],
            });
        }

        const saved = await templateDoc.save();
        if (!saved) {
            console.error("Template not saved");
            return res.status(400).json({ message: "Template not saved." });
        }

        return res.status(200).json({
            success: true,
            message: actionMessage,
            data: saved,
        });
    } catch (error) {
        console.error("Error adding template:", error.message);
        return res.status(500).json({ message: "Failed to save template.", error: error.message });
    }
};

const deleteTemplateByName = async (req, res) => {
    try {
        const { templateName, testId } = req.body || {};
        const { tid, uid, isTenantLabOperator } = resolveTemplateActor(req.user);

        const cleanTemplateName = String(templateName || "").trim();
        const cleanTestId = String(testId || "").trim();

        if (!tid || !uid) {
            return res.status(401).json({ message: "Unauthorized request." });
        }

        if (!cleanTemplateName) {
            console.error("Missing required field: templateName");
            return res.status(400).json({ message: "templateName is a required field." });
        }

        if (cleanTestId && !mongoose.Types.ObjectId.isValid(cleanTestId)) {
            return res.status(400).json({ message: "Invalid testId." });
        }

        const baseFilter = {
            tenantId: tid,
            "templates.templateName": cleanTemplateName,
            ...(cleanTestId ? { testId: cleanTestId } : {}),
        };

        // Prefer current user's template document first, then tenant lab documents for admin/staff
        let templateDoc = await testTemplate.findOne({
            ...baseFilter,
            createdBy: uid,
        });

        if (!templateDoc && isTenantLabOperator) {
            templateDoc = await testTemplate.findOne(baseFilter);
        }

        if (!templateDoc) {
            return res.status(404).json({ message: `No template found with the name "${cleanTemplateName}".` });
        }

        templateDoc.templates = templateDoc.templates.filter(
            (template) => String(template?.templateName || "").trim() !== cleanTemplateName
        );

        const saved = await templateDoc.save();

        return res.status(200).json({
            ok: true,
            message: `Template "${cleanTemplateName}" deleted successfully.`,
            data: saved,
        });
    } catch (error) {
        console.error("Error deleting template:", error.message);
        return res.status(500).json({ message: "Failed to delete template.", error: error.message });
    }
};

const getTemplatesByTestId = async (req, res) => {
    try {
        const { testId } = req.body || {};
        const { tid, uid, isTenantLabOperator } = resolveTemplateActor(req.user);
        const cleanTestId = String(testId || "").trim();

        if (!tid || !uid) {
            return res.status(401).json({ message: "Unauthorized request." });
        }

        if (!cleanTestId) {
            return res.status(400).json({ message: "testId is required." });
        }

        if (!mongoose.Types.ObjectId.isValid(cleanTestId)) {
            return res.status(400).json({ message: "Invalid testId." });
        }

        if (isTenantLabOperator) {
            const templateDocs = await testTemplate.find({
                tenantId: tid,
                testId: cleanTestId,
            }).lean();

            if (!templateDocs || templateDocs.length === 0) {
                return res.status(200).json({ message: "No templates found for this testId.", data: { templates: [] } });
            }

            // Merge templates across the lab tenant, preferring current user's versions on name collision
            const sortedDocs = [...templateDocs].sort((a, b) => {
                const aIsOwner = String(a?.createdBy) === String(uid) ? 0 : 1;
                const bIsOwner = String(b?.createdBy) === String(uid) ? 0 : 1;
                return aIsOwner - bIsOwner;
            });

            const mergedByName = new Map();
            for (const doc of sortedDocs) {
                for (const tpl of doc?.templates || []) {
                    const key = String(tpl?.templateName || "").trim().toLowerCase();
                    if (key && !mergedByName.has(key)) {
                        mergedByName.set(key, tpl);
                    }
                }
            }

            return res.status(200).json({
                message: "Templates retrieved successfully.",
                data: {
                    testId: cleanTestId,
                    tenantId: tid,
                    templates: Array.from(mergedByName.values()),
                },
            });
        }

        const templateDoc = await testTemplate.findOne({
            tenantId: tid,
            createdBy: uid,
            testId: cleanTestId,
        }).lean();

        if (!templateDoc) {
            return res.status(200).json({ message: "No templates found for this testId.", data: { templates: [] } });
        }

        return res.status(200).json({
            message: "Templates retrieved successfully.",
            data: templateDoc,
        });
    } catch (error) {
        console.error("Error retrieving templates:", error.message);
        return res.status(500).json({ message: "Failed to retrieve templates.", error: error.message });
    }
};

export {
    saveTestTemplate,
    getTemplatesByTestId,
    deleteTemplateByName
};
