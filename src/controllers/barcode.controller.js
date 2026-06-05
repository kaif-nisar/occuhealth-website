import { createCanvas } from "canvas";
import JsBarcode from "jsbarcode";

const barcodegeneratecontroller = async (req, res) => {
    const { number } = req.body;
    const { nonumber = "false", displayValue, background = "#ffffff" } = req.query;
    const shouldDisplayValue = displayValue !== undefined
        ? String(displayValue) === "true"
        : String(nonumber) !== "true";

    if (!number) {
        return res.status(400).json({ success: false, message: "Number is required to generate barcode." });
    }

    try {
        // Define canvas dimensions based on expected barcode size
        const width = 800; // Width of the canvas
        const height = 180; // Height of the canvas to accommodate larger text
        const canvas = createCanvas(width, height);

        // Generate the barcode with customized text options
        JsBarcode(canvas, number, {
            format: "CODE128",     // Barcode format
            width: 2,             // Width of each bar
            height: 110,          // Height of the barcode
            fontSize: 20,         // Increase font size for the number
            font: "sans-serif",   // Set font family
            textColor: "#000000", // Set text color to black
            displayValue: shouldDisplayValue,
            background,
            margin: 10,           // Margin around the barcode
            textMargin: 5,        // Space between the barcode and the text
        });

        // Convert to base64
        const barcodeImage = canvas.toDataURL("image/png"); // PNG format for better quality

        // Send the image back as a response
        res.status(200).json({
            success: true,
            barcode: barcodeImage, // Base64 string of the barcode image
        });
    } catch (error) {
        console.error("Error generating barcode:", error);
        res.status(500).json({ success: false, message: "Failed to generate barcode." });
    }
};

export { barcodegeneratecontroller };

