import { testTemplate } from "../models/testTemplate.model.js";

const saveTestTemplate = async (req, res) => {
    try {
        const { testId, templateName, content } = req.body;

        const tid = req.user.tenantId._id;
        const uid = req.user._id;

        if (!testId || !templateName || !content) {
            console.error("Missing required fields");
            return res.status(400).json({ message: "testId, templateName, and content are required fields." });
        }

        // Check if a document with the given testId exists
        let templateDoc = await testTemplate.findOne({ 
            testId,
            tenantId: tid,
            createdBy: uid
         });

        if (templateDoc) {
            // Document exists, add the new template to the `templates` array
            templateDoc.templates.push({ templateName, content });
        } else {
            // Document does not exist, create a new one
            templateDoc = new testTemplate({
                tenantId: tid,
                createdBy: uid,
                testId,
                templates: [{ templateName, content }],
            });
        }

        // Save the document
        const saved = await templateDoc.save();
        console.log("Saved Document:", saved);

        if (!saved) {
            console.error("Template not saved");
            return res.status(400).json({ message: "Template not saved" });
        }

        return res.status(200).json({
            message: "Template added successfully",
            data: templateDoc,
        });
    } catch (error) {
        console.error("Error adding template:", error.message);
        return res.status(500).json({ error: "Failed to add template" });
    }
};

const deleteTemplateByName = async (req, res) => {
    try {
        const { templateName } = req.body;
        const uid = req.user._id;
        const tid = req.user.tenantId._id;


        if (!templateName) {
            console.error("Missing required field: templateName");
            return res.status(400).json({ message: "templateName is a required field." });
        }

        // Find the document that contains the given templateName
        let templateDoc = await testTemplate.findOne({
            "templates.templateName": templateName,
            tenantId: tid,
            createdBy: uid
        });

        if (!templateDoc) {
            return res.status(404).json({ message: `No template found with the name "${templateName}".` });
        }

        // Filter out the template with the matching templateName
        const initialLength = templateDoc.templates.length;
        templateDoc.templates = templateDoc.templates.filter(
            (template) => template.templateName !== templateName
        );

        // Save the updated document
        const saved = await templateDoc.save();
        console.log("Updated Document:", saved);

        return res.status(200).json({
            ok: true,
            message: `Template "${templateName}" deleted successfully.`,
            data: templateDoc,
        });
    } catch (error) {
        console.error("Error deleting template:", error.message);
        return res.status(500).json({ error: "Failed to delete template" });
    }
};

const getTemplatesByTestId = async (req, res) => {
    try {
        const { testId } = req.body;

        const uid = req.user._id;
        const tid = req.user.tenantId._id;

        if (!testId) {
            return res.status(200).json({ message: "testId is required." });
        }

        // Check if the document exists for the given testId
        const templateDoc = await testTemplate.findOne({ 
            tenantId: tid,
            createdBy: uid,
            testId
         });

        if (!templateDoc) {
            console.log("No templates found for testId:", testId);
            return res.status(200).json({ message: "No templates found for this testId." });
        }

        return res.status(200).json({
            message: "Templates retrieved successfully.",
            data: templateDoc,
        });
    } catch (error) {
        console.error("Error retrieving templates:", error.message);
        return res.status(500).json({ error: "Failed to retrieve templates." });
    }
};

export { saveTestTemplate,
    getTemplatesByTestId,
    deleteTemplateByName
 };
