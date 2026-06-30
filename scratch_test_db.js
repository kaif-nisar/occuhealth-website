import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://ahadsidd5:Ahad9520@cluster0.uiadu.mongodb.net/franchisee_super_admin";

const customizationSchema = new mongoose.Schema({
    tenantId: mongoose.Types.ObjectId,
    bookingId: String,
    format: String,
    attachments: Array
}, { strict: false });

const Customization = mongoose.model('Customization', customizationSchema, 'customizations');

async function run() {
    try {
        console.log("Connecting to Database...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected successfully!");

        // Find last 10 customization documents with format bookingAttachments
        const docs = await Customization.find({ format: "bookingAttachments" }).sort({ updatedAt: -1 }).limit(10).lean();
        console.log(`\nFound ${docs.length} attachment documents:`);
        for (const doc of docs) {
            console.log("-----------------------------------------");
            console.log(`ID: ${doc._id}`);
            console.log(`TenantId: ${doc.tenantId}`);
            console.log(`BookingId: ${doc.bookingId}`);
            console.log(`Format: ${doc.format}`);
            console.log(`Attachments Count: ${doc.attachments?.length || 0}`);
            if (doc.attachments && doc.attachments.length > 0) {
                console.log("Attachments details:");
                doc.attachments.forEach((a, i) => {
                    console.log(`  [${i}] fileName: ${a.fileName}, fileType: ${a.fileType}, resourceType: ${a.resourceType}, url: ${a.url}`);
                });
            }
        }

        // Let's also search for ALL customization documents that have attachments field with items, regardless of format
        const allDocsWithAttachments = await Customization.find({ 
            attachments: { $exists: true, $not: { $size: 0 } } 
        }).sort({ updatedAt: -1 }).limit(5).lean();
        console.log("\n=========================================");
        console.log(`Found ${allDocsWithAttachments.length} documents in customization collection with non-empty attachments:`);
        for (const doc of allDocsWithAttachments) {
            console.log("-----------------------------------------");
            console.log(`ID: ${doc._id}`);
            console.log(`BookingId: ${doc.bookingId}`);
            console.log(`ReportId: ${doc.reportId}`);
            console.log(`Format: ${doc.format}`);
            console.log(`Attachments Count: ${doc.attachments?.length || 0}`);
            doc.attachments?.forEach((a, i) => {
                console.log(`  [${i}] fileName: ${a.fileName}, fileType: ${a.fileType}, url: ${a.url}`);
            });
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
    }
}

run();
