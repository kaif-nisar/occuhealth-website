import { addPannel } from "../models/AddPannel.model.js";
import { testSchema } from "../models/newTest.model.js";
import { Package } from "../models/addPackage.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";

const allTestdetails = asyncHandler(async (req, res) => {
    const { value1 } = req.body;

    const singleTestsSet = new Set(); // To hold unique single tests
    const panelsData = []; // To hold panels and their tests as objects

    for (const tpp of value1) {
        const trimmedTpp = tpp.trim();

        // Check if it's a single test
        const singleTest = await testSchema.findOne({ Name: trimmedTpp });
        if (singleTest) {
            singleTestsSet.add(JSON.stringify(singleTest));
            continue; // Move to the next item in the loop
        }

        // Check if it's a panel
        const panel = await addPannel.findOne({ name: trimmedTpp });
        if (panel) {
            const panelTests = [];

            for (const testName of panel.tests) {
                const test = await testSchema.findOne({ Name: testName });
                if (test) {
                    panelTests.push(test); // Add test to panel's test array
                }
            }

            panelsData.push({
                panelDocument: panel, // Full panel document
                tests: panelTests, // Tests associated with this panel
            });
            continue;
        }

        // Check if it's a package
        const packageData = await Package.findOne({ packageName: trimmedTpp });
        if (packageData) {
            // Process single tests in the package
            for (const testName of packageData.testname || []) {
                const test = await testSchema.findOne({ Name: testName });
                if (test) {
                    singleTestsSet.add(JSON.stringify(test));
                }
            }

            // Process panels in the package
            for (const panelName of packageData.pannelname || []) {
                const panel = await addPannel.findOne({ name: panelName });
                if (panel) {
                    const panelTests = [];

                    for (const testName of panel.tests) {
                        const test = await testSchema.findOne({ Name: testName });
                        if (test) {
                            panelTests.push(test);
                        }
                    }

                    panelsData.push({
                        panelDocument: panel, // Full panel document
                        tests: panelTests, // Tests associated with this panel
                    });
                }
            }
        }
    }

    // Convert singleTestsSet to an array and parse JSON
    const singleTests = Array.from(singleTestsSet).map((test) => JSON.parse(test));

    // Construct response
    const response = {
        singleTests,
        panels: panelsData,
    };

    console.log(response);
    res.status(200).json(response);
});

const defaultResultsGet = asyncHandler(async (req, res) => {

    const { testName } = req.body;

    console.log(testName)

    if (!testName) {
        throw new ApiError(500, "please click again on edit range")
    }

    const testDocument = await testSchema.findOne({ 
        "parameters.Para_name": testName
     });

    console.log("testDocument:", testDocument)

    if (!testDocument) {
        throw new ApiError(500, "test not found sorry")
    }

    return res.json(testDocument);

})

export {
    allTestdetails,
    defaultResultsGet
};
