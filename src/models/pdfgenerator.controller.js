import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import fetch from 'node-fetch'; // Import node-fetch to handle fetching images
import { fileURLToPath } from 'url'; // Import fileURLToPath for ES Modules
import { PDFDocument } from 'pdf-lib';
import { customization } from '../models/printsetting.model.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { invoices } from '../models/invoicepdf.model.js';
import { certificates } from '../models/certificate.model.js';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);

// second try=====================================================================

const adjustPdfMargins = async (pdfBuffer, marginRight, marginLeft) => {
    // Parse margins with default value
    marginRight = marginRight || 0;
    marginLeft = marginLeft || 0;


    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    for (const page of pages) {
        const { width, height } = page.getSize();

        // Calculate the new dimensions
        const newWidth = width - marginLeft - marginRight;
        const scaleFactor = newWidth / width;

        if (newWidth <= 0) {
            throw new Error("Margins are too large for the page width!");
        }

        // Scale content proportionally
        page.scaleContent(scaleFactor, scaleFactor);

        // Translate content to respect margins
        const translateX = marginLeft;
        const translateY = (height - height * scaleFactor) / 2; // Center vertically
        page.translateContent(translateX, translateY);

    }

    // Save the adjusted PDF
    const modifiedPdfBuffer = await pdfDoc.save();
    return modifiedPdfBuffer;
};


const addBackgroundToPdf = async (inputPdfBuffer, backgroundImageUrl) => {

    if (!inputPdfBuffer) {
        console.error('Input PDF buffer is null or undefined');
        return null;
    }

    try {
        const inputPdfDoc = await PDFDocument.load(inputPdfBuffer);

        const outputPdfDoc = await PDFDocument.create();

        let backgroundImage = null;

        if (backgroundImageUrl) {
            // Fetch and embed the background image if URL is provided
            const fetchImageAsBase64FromUrl = async (url) => {
                try {
                    const response = await fetch(url);
                    const buffer = await response.buffer();
                    return buffer.toString('base64');
                } catch (error) {
                    console.error('Error fetching background image:', error);
                    return null;
                }
            };

            const backgroundImageBase64 = await fetchImageAsBase64FromUrl(backgroundImageUrl);
            if (!backgroundImageBase64) {
            } else {
                try {
                    backgroundImage = await outputPdfDoc.embedJpg(Buffer.from(backgroundImageBase64, 'base64'));
                } catch (err) {
                    console.warn('Failed to embed JPG image, trying PNG');
                    try {
                        backgroundImage = await outputPdfDoc.embedPng(Buffer.from(backgroundImageBase64, 'base64'));
                    } catch (pngError) {
                        console.error('Failed to embed PNG image:', pngError);
                        backgroundImage = null;
                    }
                }
            }
        } else {
            console.log('No background image URL provided, proceeding with blank background');
        }

        const pages = inputPdfDoc.getPages();
        const pageWidth = pages[0].getWidth();
        const pageHeight = pages[0].getHeight();

        for (let i = 0; i < pages.length; i++) {
            const newPage = outputPdfDoc.addPage([pageWidth, pageHeight]);

            // Draw the background image if available
            if (backgroundImage) {
                newPage.drawImage(backgroundImage, {
                    x: 0,
                    y: 0,
                    width: pageWidth,
                    height: pageHeight,
                });
            }

            // Copy the current page from the input PDF
            const [copiedPage] = await outputPdfDoc.embedPages([inputPdfDoc.getPages()[i]]);
            if (!copiedPage) {
                console.error(`Failed to copy page at index ${i}`);
                return null;
            }

            newPage.drawPage(copiedPage, {
                x: 0,
                y: 0,
                width: pageWidth,
                height: pageHeight,
            });
        }

        const pdfBytes = await outputPdfDoc.save();
        return pdfBytes;
    } catch (error) {
        console.error('Error adding background to PDF:', error);
        return null;
    }
};

// Function to convert image URL to Base64
const convertImageToBase64 = async (imageUrl) => {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        return buffer.toString('base64');
    } catch (error) {
        console.error('Error fetching image:', error);
        return null;
    }
};

// Function to process HTML and convert all images to Base64
const convertImagesInHtmlToBase64 = async (htmlContent) => {
    const $ = cheerio.load(htmlContent);  // Load HTML content using cheerio
    const images = $('img');  // Select all <img> tags

    // Iterate over each <img> tag
    for (let i = 0; i < images.length; i++) {
        const img = $(images[i]);
        const imageUrl = img.attr('src');  // Get the 'src' attribute of the image

        // Convert image to Base64 if the src is an image URL
        if (imageUrl && !imageUrl.startsWith('data:image')) {
            const base64Image = await convertImageToBase64(imageUrl);
            if (base64Image) {
                // Update the 'src' attribute with the Base64 string
                img.attr('src', `data:image/png;base64,${base64Image}`);
            }
        }
    }

    // Return updated HTML with Base64 images
    return $.html();
};

const pdfgeneratorcontroller2 = async ({ pdfformat, showInvest, BoldRow, HLinred, HighLow, RowSpacing,
    selectedFontSize, reportId, htmlContent,
    cssContent, header, footer, backgroundImageUrl, headermargin, footermargin, marginRight,
    marginLeft, investigationmargin, showlab, showdoctorfirst,
    showdoctorsecond, fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext,
    fileInputDoctorlefttext, fileInputDoctorrighttext, res }) => {

    const format3 = pdfformat === "reportFormat3" ? true : false;

    console.log("reportId:", reportId);
    console.log("showlab:", showlab);
    console.log("showdoctorfirst:", showdoctorfirst);
    console.log("showdoctorsecond:", showdoctorsecond);
    console.log("fileInputLab:", fileInputLab);
    console.log("fileInputDoctorleft:", fileInputDoctorleft);
    console.log("fileInputDoctorright:", fileInputDoctorright);


    const cmToPx = (cm) => cm * 37.795;

    let headermarginPx;
    let footermarginPx;
    let marginRightPx;
    let marginLeftPx;

    // Conversion from cm to px
    if (marginRight || marginLeft) {
        marginRightPx = cmToPx(parseFloat(marginRight));
        marginLeftPx = cmToPx(parseFloat(marginLeft));
    }

    headermarginPx = cmToPx(parseFloat(headermargin));
    footermarginPx = cmToPx(parseFloat(footermargin));

    const imageUrls = [fileInputDoctorleft, fileInputLab, fileInputDoctorright];

    const getMimeTypeFromUrl = (url) => {
        if (url?.endsWith(".jpg") || url?.endsWith(".jpeg")) return "image/jpeg";
        if (url?.endsWith(".png")) return "image/png";
        if (url?.endsWith(".webp")) return "image/webp";
        return "image/*";
    };

    const mimeTypes = imageUrls.map(getMimeTypeFromUrl);

    const convertToBase64 = async (imageUrl) => {
        try {
            if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
                throw new Error(`Invalid image URL: ${imageUrl}`);
            }
            const response = await fetch(imageUrl);
            const buffer = await response.arrayBuffer();
            return Buffer.from(buffer).toString('base64');
        } catch (error) {
            console.error(`Failed to convert image: ${error.message}`);
            return null;
        }
    };

    const base64Images = await Promise.all(imageUrls.map(convertToBase64));


    try {
        const browser = await puppeteer.launch({});
        const page = await browser.newPage();

        const contentWithCssAndImage = `
            <html>
                <head>
                    <style>
                     *{
                                margin: 0px;
                                padding: 0px;
                                box-sizing: border-box;
                            }
                        html, body, table, tr, th, td, div, span, input, button, textarea, select, p {
                            font-family: "Tahoma", "Arial", sans-serif !important;
                            letter-spacing: 0.1px;
                        }
                        ${cssContent}
                        .wrong i, .delete-btn i {
                            display: none;
                        }
                        h2 {
                        margin: 0 !important;
                        padding: 0 !important;
                        }
                        .headings {
                        margin-top: 0 !important;
                        margin-bottom: 0px !important;
                        }
                        tr,th {
                            font-size: ${selectedFontSize}px !important;
                        }
                        td {
                            padding-top: ${parseFloat(RowSpacing) / 2}px !important;
                            padding-bottom: ${parseFloat(RowSpacing) / 2}px !important;
                        }
                        td .HL span {
                        display: ${HighLow ? 'block' : 'none'};
                        }
                        .high-low span{
                        color: ${HLinred ? '#9b111e' : 'black'} !important;
                        }
                        .BoldRow, .BoldRow td, .BoldRow th, .BoldRow td * {
                        font-weight: ${BoldRow ? '700' : '400'} !important; 
                        }
                        .abnormal-result, .abnormal-result * {
                        color: ${HLinred ? '#9b111e' : 'inherit'} !important;
                        }
                        .deletion {
                        display: none !important;
                        }
                        td.wrong {
                        display: none !important;
                        }
                        .details-row {
                            font-size: 10px !important;
                        }
                        .methods {
                            font-size: 8px !important;
                            color: #565656 !important;
                            margin-top: 2px !important;
                        }
                    </style>
                </head>
                <body>
                    <div class="middle">
                    ${htmlContent}
                    </div>
                </body>
            </html>`;

        await page.setContent(contentWithCssAndImage, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            displayHeaderFooter: true,
            headerTemplate: `
                <html>
                    <head>
                        <style>
                            *{
                                margin: 0px;
                                padding: 0px;
                                box-sizing: border-box;
                            }
                            .pdf-header-div {
                                width: ${format3 ? "100%" : "95%"}; 
                                margin:  0 auto;
                                border: ${format3 ? "none" : "1px solid black"};
                                margin-top: ${format3 ? "0" : headermargin}cm !important;
                            }
                            .report-details-innerDiv2 {
                            width: ${format3 ? "95%" : "100%"} !important;
                            font-size: 12px;
                            margin-top: ${format3 ? headermargin : "0"}cm !important;
                            border: none !important;
                            }
                            #investDiv {
                            display: ${showInvest ? 'flex' : 'none'} !important;
                            }
                            .time-div {
                                width: 40% !important;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="pdf-header-div"> 
                        ${header}
                    </div>
                    </body>
                </html>`,
            footerTemplate: `
                <html>
                    <head>
                        <style>
                         *{
                                margin: 0px;
                                padding: 0px;
                                box-sizing: border-box;
                            }
                            html, body, table, tr, th, td, div, span, input, button, textarea, select, p {
                                font-family: "Tahoma", "Arial", sans-serif !important;
                                letter-spacing: 0.1px;
                            }
                            ${cssContent}
                            .pdf-footer-div {
                            width: 92%; 
                            font-size: 12px; 
                            font-weight: 450; 
                            text-align: center; 
                            margin: 0px auto;
                            margin-bottom: ${footermarginPx}px;
                            }
                        </style>
                    </head>
                    <body>
                <div class="pdf-footer-div">
                    <div class="signed-off-div2">
                        <div class="left-sign" style="display: ${showdoctorfirst ? 'block' : 'none'};">
                            <img src="data:${mimeTypes[0]};base64,${base64Images[0]}" width="100" height="50" /><br>
                            <div class="textspan">${fileInputDoctorlefttext}</div>
                        </div>
                        <div class="left-sign" style="display: ${showlab ? 'block' : 'none'};">
                            <img src="data:${mimeTypes[1]};base64,${base64Images[1]}" width="100" height="50" /><br>
                            <div class="textspan">${fileInputLabtext}</div>
                        </div>
                        <div class="right-sign" style="display: ${showdoctorsecond ? 'block' : 'none'};">
                            <img src="data:${mimeTypes[2]};base64,${base64Images[2]}" width="100" height="50"  /><br>
                            <div class="textspan">${fileInputDoctorrighttext}</div>
                        </div>
                    </div>
                </div>
                    </body>
                </html>`,
            margin: { top: `${headermarginPx + ((showInvest ? investigationmargin : -1) * 13) + (format3 ? 210 : 110)}px`, bottom: '175px', left: `10px`, right: `10px` },
        });

        await browser.close();

        const finalPdfBuffer = await addBackgroundToPdf(pdfBuffer, backgroundImageUrl);

        if (!finalPdfBuffer) {
            console.error('Final PDF buffer is null');
            res.status(500).send('Failed to generate final PDF');
            return;
        }

        const finalpdfbufferwithmargin = await adjustPdfMargins(finalPdfBuffer, marginRightPx, marginLeftPx);


        // Dynamically build the update object
        const updateData = {
            showInvest: showInvest,
            BoldRow: BoldRow,
            HLinred: HLinred,
            HighLow: HighLow,
            RowSpacing: parseFloat(RowSpacing),
            selectedFontSize: parseFloat(selectedFontSize),
            reportId: reportId,
            htmlContent: htmlContent,
            cssContent: cssContent,
            header: header,
            footer: footer,
            headermargin: headermargin,
            footermargin: footermargin,
            marginRight: marginRight,
            marginLeft: marginLeft,
            investigationmargin: investigationmargin,
            showlab: showlab,
            showdoctorfirst: showdoctorfirst,
            showdoctorsecond: showdoctorsecond,
            fileInputLab: fileInputLab,
            fileInputDoctorleft: fileInputDoctorleft,
            fileInputDoctorright: fileInputDoctorright,
            fileInputLabtext: fileInputLabtext,
            fileInputDoctorlefttext: fileInputDoctorlefttext,
            fileInputDoctorrighttext: fileInputDoctorrighttext,
            updatedAt: new Date()
        };

        // Add backgroundImageUrl to the update object only if it is not empty
        if (backgroundImageUrl) {
            updateData.backgroundImageUrl = backgroundImageUrl;
        }

        // Save the path to the database
        const getcustomization = await customization.findOneAndUpdate(
            { reportId: reportId }, // Or use some identifier
            updateData,
            {
                new: true,  // Return the updated document
                upsert: true, // Create new record if it doesn't exist
            }
        );


        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="final_report.pdf"');
        res.setHeader('Content-Length', finalpdfbufferwithmargin.length);
        res.end(finalpdfbufferwithmargin);

    } catch (error) {
        console.error('Error generating final PDF:', error.message);
        res.status(500).send('Error generating final PDF');
    }
}

const getpdfcontroller = async (req, res) => {

    const { value1, checkBox, htmlContent, cssContent, header, footer, backgroundImageUrl,
        headermargin, footermargin, marginRight, marginLeft, selectedFontSize, RowSpacing, HighLow,
        HLinred, BoldRow, showInvest, DownloadPdf, investigationmargin, showlab, showdoctorfirst,
        showdoctorsecond, fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext,
        fileInputDoctorlefttext, fileInputDoctorrighttext } = req.body;

    let pdfformat;

    if (req.user.role === "admin") {
        pdfformat = req.user.pdfFormat;
    } else {
        pdfformat = req.user.createdBy.pdfFormat;
    }

    try {
        // Attempt to fetch data from the database
        const gettingcustomization = await customization.findOne({ reportId: value1 });
        let mergedValues;

        if (checkBox || DownloadPdf) {
            // Define fallback logic to prioritize database values first
            mergedValues = {
                pdfformat: pdfformat,
                showInvest: showInvest ?? gettingcustomization?.showInvest ?? false, // Updated logic     
                BoldRow: BoldRow ?? gettingcustomization?.BoldRow ?? false, // Updated logic     
                HLinred: HLinred ?? gettingcustomization?.HLinred ?? false, // Updated logic     
                HighLow: HighLow ?? gettingcustomization?.HighLow ?? false, // Updated logic     
                RowSpacing: RowSpacing || gettingcustomization.RowSpacing || 7,
                selectedFontSize: selectedFontSize || gettingcustomization.selectedFontSize || 12,
                reportId: value1,
                htmlContent: htmlContent || gettingcustomization?.htmlContent || "", // Priority: Database > Request > Default
                cssContent: cssContent || gettingcustomization?.cssContent || "",
                header: header || gettingcustomization?.header || "",
                footer: footer || gettingcustomization?.footer || "",
                backgroundImageUrl: "",
                headermargin: headermargin || gettingcustomization?.headermargin || "2.8",
                footermargin: footermargin || gettingcustomization?.footermargin || "1",
                marginRight: marginRight || gettingcustomization?.marginRight || "0",
                marginLeft: marginLeft || gettingcustomization?.marginLeft || "0",
                investigationmargin: investigationmargin || gettingcustomization?.investigationmargin || "1",
                showlab: showlab ?? gettingcustomization?.showlab ?? false,
                showdoctorfirst: showdoctorfirst ?? gettingcustomization?.showdoctorfirst ?? true,
                showdoctorsecond: showdoctorsecond ?? gettingcustomization?.showdoctorsecond ?? true,
                fileInputLab: fileInputLab || gettingcustomization?.fileInputLab || "",
                fileInputDoctorleft: fileInputDoctorleft || gettingcustomization?.fileInputDoctorleft || "",
                fileInputDoctorright: fileInputDoctorright || gettingcustomization?.fileInputDoctorright || "",
                fileInputLabtext: fileInputLabtext || gettingcustomization?.fileInputLabtext || "",
                fileInputDoctorlefttext: fileInputDoctorlefttext || gettingcustomization?.fileInputDoctorlefttext || "",
                fileInputDoctorrighttext: fileInputDoctorrighttext || gettingcustomization?.fileInputDoctorrighttext || "",
                res
            };
        } else {
            // Define fallback logic to prioritize database values first
            mergedValues = {
                pdfformat: pdfformat,
                showInvest: showInvest ?? gettingcustomization?.showInvest ?? false, // Updated logic     
                BoldRow: BoldRow ?? gettingcustomization?.BoldRow ?? false, // Updated logic     
                HLinred: HLinred ?? gettingcustomization?.HLinred ?? false, // Updated logic     
                HighLow: HighLow ?? gettingcustomization?.HighLow ?? false, // Updated logic     
                RowSpacing: RowSpacing || gettingcustomization.RowSpacing || 8,
                selectedFontSize: selectedFontSize || gettingcustomization.selectedFontSize || 12,
                reportId: value1,
                htmlContent: htmlContent || gettingcustomization?.htmlContent || "", // Priority: Database > Request > Default
                cssContent: cssContent || gettingcustomization?.cssContent || "",
                header: header || gettingcustomization?.header || "",
                footer: footer || gettingcustomization?.footer || "",
                backgroundImageUrl: backgroundImageUrl || gettingcustomization?.backgroundImageUrl || "",
                headermargin: headermargin || gettingcustomization?.headermargin || "2.8",
                footermargin: footermargin || gettingcustomization?.footermargin || "1",
                marginRight: marginRight || gettingcustomization?.marginRight || "0",
                marginLeft: marginLeft || gettingcustomization?.marginLeft || "0",
                investigationmargin: investigationmargin || gettingcustomization?.investigationmargin || "1",
                showlab: showlab ?? gettingcustomization?.showlab ?? false,
                showdoctorfirst: showdoctorfirst ?? gettingcustomization?.showdoctorfirst ?? true,
                showdoctorsecond: showdoctorsecond ?? gettingcustomization?.showdoctorsecond ?? true,
                fileInputLab: fileInputLab || gettingcustomization?.fileInputLab || "",
                fileInputDoctorleft: fileInputDoctorleft || gettingcustomization?.fileInputDoctorleft || "",
                fileInputDoctorright: fileInputDoctorright || gettingcustomization?.fileInputDoctorright || "",
                fileInputLabtext: fileInputLabtext || gettingcustomization?.fileInputLabtext || "",
                fileInputDoctorlefttext: fileInputDoctorlefttext || gettingcustomization?.fileInputDoctorlefttext || "",
                fileInputDoctorrighttext: fileInputDoctorrighttext || gettingcustomization?.fileInputDoctorrighttext || "",
                res
            };
        }

        // Generate the PDF with merged values
        await pdfgeneratorcontroller2(mergedValues);

    } catch (error) {
        console.error('Error fetching PDF:', error.message);
        res.status(500).json({ message: 'Error fetching PDF', error: error.message });
    }
};

const savingPdfDatacontroller = async (req, res) => {

    const tenantId = req.user.tenantId._id;
    const userId = req.user._id;
    const { reportId, htmlContent, cssContent, header, footer, backgroundImageUrl,
        headermargin, footermargin, investigationmargin, showlab, showdoctorfirst,
        showdoctorsecond, fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext,
        fileInputDoctorlefttext, fileInputDoctorrighttext } = req.body;

    // Best balance of safety + simplicity
    const vars = { reportId, htmlContent, cssContent, header, footer, backgroundImageUrl,
        headermargin, footermargin, investigationmargin, showlab, showdoctorfirst,
        showdoctorsecond, fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext,
        fileInputDoctorlefttext, fileInputDoctorrighttext };

    const updateFields = {};
    for (const key in vars) {
        if (vars[key] != null) updateFields[key] = vars[key];
    }
    updateFields.updatedAt = new Date();

    const getcustomization = await customization.findOneAndUpdate(
        {
            reportId: reportId,
            tenantId: tenantId,
            createdBy: userId
        }, // Or use some identifier
        updateFields,
        {
            new: true,  // Return updated document
            upsert: true, // Create new record if it doesn't exist
        }
    );

    return res.json(getcustomization)
}

const getCustomizationByReportId = async (req, res) => {
    try {
        // Extract reportId from the request
        const { reportId } = req.body;

        if (!reportId) {
            return console.log('pdf data not found in database')
        }

        // Find the document by reportId
        const customizationData = await customization.findOne({ reportId: reportId });

        if (!customizationData) {
            return res.status(404).json({ message: "No customization found for the given Report ID" });
        }

        // Return the found document
        return res.status(200).json(customizationData);
    } catch (error) {
        console.error("Error fetching customization data:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const invoicepdfgenerator = async (req, res) => {
    let { invoiceHtml, invoicecss, billnumber, bookingId, generatedBy, billingPrice } = req.body;

    // const getdoc = await invoices.findOne({
    //     bookingId: bookingId
    // })

    // if (getdoc) {
    //     invoiceHtml = getdoc.invoiceHtml;
    //     invoicecss = getdoc.invoiceCss;
    // }

    try {
        const browser = await puppeteer.launch(); 
        const page = await browser.newPage();

        // Viewport set karein
        await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });

        const contentwithhtmlcss = `
        <html>
        <head>
        <style>
        ${invoicecss}
        </style>
        </head>
        <body>
        ${invoiceHtml}
        </body>
        </html>`;

        await page.setContent(contentwithhtmlcss, { waitUntil: 'load' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
        });

        await browser.close();

        // if (!getdoc) {
        //     const document = await invoices.create({
        //         invoiceCss: invoicecss,
        //         invoiceHtml: invoiceHtml,
        //         billNumber: billnumber,
        //         generatedBy,
        //         billingPrice,
        //         bookingId
        //     })
        // }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="final_report.pdf"');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);

    } catch (error) {
        console.log(error)
    }

}

const certificatepdfgenerator = async (req, res) => {
    let { pdfHtml, pdfcss, userId } = req.body;

    const getdoc = await certificates.findOne({ userId })

    if (getdoc) {
        pdfHtml = getdoc.pdfHtml;
        pdfcss = getdoc.pdfcss;
    }

    try {
        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome-stable',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true
        });
        const page = await browser.newPage();

        const contentwithhtmlcss = `
        <html>
        <head>
        <style>
        ${pdfcss}
        </style>
        </head>
        <body>
        ${pdfHtml}
        </body>
        </html>`;

        await page.setContent(contentwithhtmlcss, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            landscape: true,
            margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' }
        });

        await browser.close();

        if (!getdoc) {
            const document = await certificates.create({
                pdfcss: pdfcss,
                pdfHtml: pdfHtml,
                userId: userId
            })
        }
         // अगर staff का parentUser है तो उसे भी notify करें
                if (req.user.role === 'staff') {
                    console.log("Staff report update activity log");
                    await User.findByIdAndUpdate(req.user._id, {
                        $push: {
                            activities: {
                                activityType: "other",
                                details: {
                                    staffId: req.user._id,
                                    staffName: req.user.fullName,
                                    action: `${req.user.fullName} has created a certificate.`,
                                },
                                reference: {
                                    model: "Certificate",
                                },
                                timestamp: new Date()
                            }
                        }
                    });
                }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="final_report.pdf"');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);

    } catch (error) {
        console.log(error)
    }

}

export {
    pdfgeneratorcontroller2,
    getpdfcontroller,
    savingPdfDatacontroller,
    getCustomizationByReportId,
    invoicepdfgenerator,
    certificatepdfgenerator
};


