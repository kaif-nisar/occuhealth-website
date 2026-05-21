import { lisdata } from "../models/lismodel.js";

const getresult = async (req, res) => {
    try {
        const dataObject = req.body;

        console.log("this is the actual data:", dataObject);
        console.log("LIS Data Received:", JSON.stringify(dataObject, null, 2));

        if (!dataObject || Object.keys(dataObject).length === 0) {
            return res.status(400).json({
                data: null,
                message: "No data received in body",
                status: "Error",
                success: false
            });
        }

        const doc = await lisdata.create({
            lisData: dataObject
        })

        if (!doc) {
            return res.status(500).json({
                data: req.body,
                message: "data received but still not save. please try again",
                status: "error",
                success: false
            });
        }
        return res.status(200).json({
            data: req.body,
            message: "data saved successfully",
            status: "success",
            success: true
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({
            data: null,
            message: "Internal server error",
            status: "Error",
            success: false
        });
    }
}

const getbarcoderesult = async (req, res) => {
    try {
        const { barcodeIds } = req.body;

        console.log(barcodeIds);

        if (!Array.isArray(barcodeIds) || barcodeIds.length === 0) {

            console.log("barcodeIds should be a non-empty array");

            return res.status(400).json({
                data: null,
                message: "barcodeIds should be a non-empty array",
                status: "Error",
                success: false
            });
        }

        const docs = await lisdata.find({
            "lisData.sample_id": { $in: barcodeIds }
        });

        const groupedResults = {};
        for (const barcodeId of barcodeIds) {
            groupedResults[barcodeId] = docs.filter(doc => doc.lisData.sample_id === barcodeId);
        }

        console.log(groupedResults);

        if (!groupedResults || Object.values(groupedResults).every(arr => arr.length === 0)) {

            const lisdocs = await lisdata.findOne({});

            if (!lisdocs) {
                return res.status(500).json({
                    data: null,
                    message: "❗ The LIS (Laboratory Information System) setup for your machines has not yet been completed. As a result, data is currently not being automatically received on your portal. If you would like to enable this feature, we are ready to assist you with the configuration right away.Please feel free to contact us at 9520034895 or email us at occuhealth.info1@gmail.com for further assistance.",
                    status: "success",
                    success: true
                });
            } else {
                return res.status(200).json({
                    data: null,
                    message: "Lis data not present",
                    status: "success",
                    success: true
                });
            }
        }

        return res.status(200).json({
            data: groupedResults,
            message: "fetch complete",
            status: "success",
            success: true
        });

    } catch (error) {
        return res.status(500).json({
            data: null,
            message: error.message || "Internal Server Error",
            status: "Error",
            success: false
        });
    }
};

export {
    getresult,
    getbarcoderesult
}