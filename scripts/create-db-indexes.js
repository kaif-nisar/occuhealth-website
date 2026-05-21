import "dotenv/config";
import mongoose from "mongoose";
import Connect_DB from "../src/db/index.js";

import "../src/models/NewBooking.model.js";
import "../src/models/printsetting.model.js";
import "../src/models/reportData.model.js";
import "../src/models/Testvalues.model.js";
import "../src/models/samples.model.js";
import "../src/models/message.model.js";
import "../src/models/bookingLabName.model.js";
import "../src/models/doctor.model.js";
import "../src/models/lismodel.js";
import "../src/models/category.model.js";
import "../src/models/ledger.model.js";

async function createIndexes() {
  await Connect_DB();

  const models = [
    "testBooking",
    "Customization",
    "report",
    "BookedTestsValues",
    "acceptedBarcode",
    "Conversation",
    "booking-time-add-lab",
    "doctor",
    "lisdata",
    "categorydb",
    "unitdb",
    "counter",
    "Ledger"
  ];

  const failures = [];

  for (const modelName of models) {
    try {
      const model = mongoose.model(modelName);
      console.log(`[DB Indexes] Syncing ${modelName}`);
      await model.createIndexes();
    } catch (error) {
      failures.push({
        modelName,
        message: error.message
      });
      console.error(`[DB Indexes] Failed for ${modelName}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    console.log("[DB Indexes] Completed with failures:");
    failures.forEach(({ modelName, message }) => {
      console.log(`- ${modelName}: ${message}`);
    });
  } else {
    console.log("[DB Indexes] All indexes created successfully");
  }

  await mongoose.disconnect();

  if (failures.length > 0) {
    process.exit(1);
  }
}

createIndexes().catch(async (error) => {
  console.error("[DB Indexes] Failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
