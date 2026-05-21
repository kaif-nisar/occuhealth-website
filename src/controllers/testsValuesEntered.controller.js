import { bookedTestsresult } from "../models/Testvalues.model.js";

const saveOrUpdateBookedTest = async (req, res) => {
    try {
        const { BookingId, EnteredValues } = req.body;

        if (!BookingId || !Array.isArray(EnteredValues)) {
            return res.status(400).json({ success: false, message: "Invalid input data" });
        }

        console.log("Received EnteredValues:", EnteredValues);

        // `findOneAndUpdate` se existing record update ya create karo
        const updatedRecord = await bookedTestsresult.findOneAndUpdate(
            { BookingId }, // Condition: Agar ye BookingId ka record milta hai to update hoga
            { $set: { EnteredValues } }, // Update ya naya data set karega
            { new: true, upsert: true } // Agar nahi milta to new create karega
        );

        return res.status(updatedRecord ? 200 : 201).json({
            success: true,
            message: updatedRecord ? "Updated successfully" : "Created successfully",
            data: updatedRecord
        });

    } catch (error) {
        console.error("Error in saveOrUpdateBookedTest:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};


const getBookedTestById = async (req, res) => {
    try {
        const { BookingId } = req.body;

        if (!BookingId) {
            return res.status(400).json({ success: false, message: "BookingId is required" });
        }

        const existingRecord = await bookedTestsresult.findOne({ BookingId });

        return res.status(200).json({
            success: true,
            message: existingRecord,
            data: existingRecord || null
        });

    } catch (error) {
        console.error("Error in getBookedTestById:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export {
    saveOrUpdateBookedTest,
    getBookedTestById
};
