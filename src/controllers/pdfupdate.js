import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

// Function to read image as base64 from a local file
const fetchImageAsBase64 = (imagePath) => {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
};

const addBackgroundToPdf = async (inputPdfPath, outputPdfPath, backgroundImagePath) => {
    try {
        // Check if the input PDF file exists
        if (!fs.existsSync(inputPdfPath)) {
            throw new Error(`Input PDF file not found: ${inputPdfPath}`);
        }

        // Load the existing PDF
        const existingPdfBytes = fs.readFileSync(inputPdfPath);
        const inputPdfDoc = await PDFDocument.load(existingPdfBytes);

        // Create a new PDF document
        const outputPdfDoc = await PDFDocument.create();

        // Fetch background image as base64
        const backgroundImageBase64 = fetchImageAsBase64(backgroundImagePath);

        // Embed the background image
        const backgroundImage = await outputPdfDoc.embedJpg(Buffer.from(backgroundImageBase64, 'base64'));

        // Get all pages from the existing PDF
        const pages = inputPdfDoc.getPages();
        const pageWidth = pages[0].getWidth();
        const pageHeight = pages[0].getHeight();

        // Set a scaling factor (e.g., scale to 90% of original size)
        const scalingFactor = 0.9; // Adjust this value as needed
        const scaledWidth = pageWidth * scalingFactor;
        const scaledHeight = pageHeight * scalingFactor;

        // Copy each page from the original PDF to the new PDF and apply the background image
        for (const page of pages) {
            // Create a new page in the output PDF with the same dimensions
            const newPage = outputPdfDoc.addPage([pageWidth, pageHeight]);

            // Draw the background image on the new page
            newPage.drawImage(backgroundImage, {
                x: 0,
                y: 0,
                width: pageWidth,
                height: pageHeight,
            });

            // Embed the original page content onto the new page, but scale it
            const [copiedPage] = await inputPdfDoc.copyPages(inputPdfDoc, [pages.indexOf(page)]);

            // Embed the copied page in the new PDF
            const embeddedPage = await outputPdfDoc.embedPage(copiedPage);

            // Draw the copied page content on the new page with scaling
            newPage.drawPage(embeddedPage, {
                x: (pageWidth - scaledWidth) / 2, // Center the page horizontally
                y: (pageHeight - scaledHeight) / 2, // Center the page vertically
                width: scaledWidth,
                height: scaledHeight,
            });
        }

        // Serialize the new PDF to bytes and save it
        const pdfBytes = await outputPdfDoc.save();
        fs.writeFileSync(outputPdfPath, pdfBytes);
        console.log('PDF created with background image!');
    } catch (error) {
        console.error('Error adding background to PDF:', error);
    }
};

// Example usage
const inputPdfPath = path.resolve('labreport.pdf'); // Path to your existing PDF
const outputPdfPath = path.resolve('output.pdf');   // Path where new PDF will be saved
const backgroundImagePath = path.resolve('occuhealth.jpg'); // Path to your local background image

addBackgroundToPdf(inputPdfPath, outputPdfPath, backgroundImagePath);
