import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import puppeteer from 'puppeteer';
import PQueue from 'p-queue';
import fetch from 'node-fetch'; // Import node-fetch to handle fetching images
import { fileURLToPath } from 'url'; // Import fileURLToPath for ES Modules
import { PDFDocument } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { customization } from '../models/printsetting.model.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { invoices } from '../models/invoicepdf.model.js';
import { certificates } from '../models/certificate.model.js';
import { defaultpdfsetting } from '../models/defaultpdfsettings.model.js';
import { reports } from '../models/reportData.model.js';
import { Template } from '../models/template.model.js';
import { mergePdfWithBookingAttachments } from '../utils/pdfAttachmentMerger.js';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const securePdfStandardFontDataUrl = `${path.resolve(path.dirname(__filename), '../../node_modules/pdfjs-dist/standard_fonts').replace(/\\/g, '/')}/`;
const securePdfRenderScale = Math.min(2.25, Math.max(1.5, Number.parseFloat(process.env.PDF_SECURE_RENDER_SCALE || '1.85')));
const securePdfImageFormat = (process.env.PDF_SECURE_IMAGE_FORMAT || 'png').toLowerCase();
const securePdfJpegQuality = Math.min(1, Math.max(0.9, Number.parseFloat(process.env.PDF_SECURE_JPEG_QUALITY || '1')));
const enforceSecureReportPdf = (process.env.ENFORCE_SECURE_REPORT_PDF || 'false').toLowerCase() === 'true';
const pdfContentLoadTimeout = Number.parseInt(process.env.PDF_CONTENT_LOAD_TIMEOUT_MS || '45000', 10);
const pdfBrowserLaunchTimeout = Number.parseInt(process.env.PDF_BROWSER_LAUNCH_TIMEOUT_MS || '45000', 10);
const pdfRenderTaskTimeout = Number.parseInt(process.env.PDF_RENDER_TASK_TIMEOUT_MS || '120000', 10);
const pdfQueueConcurrency = Math.max(1, Number.parseInt(process.env.PDF_QUEUE_CONCURRENCY || '2', 10));
const pdfMemoryCleanupThresholdMb = Math.max(128, Number.parseInt(process.env.PDF_MEMORY_CLEANUP_THRESHOLD_MB || '512', 10));
const pdfPageViewport = {
    width: Number.parseInt(process.env.PDF_PAGE_VIEWPORT_WIDTH || '1280', 10),
    height: Number.parseInt(process.env.PDF_PAGE_VIEWPORT_HEIGHT || '1810', 10),
    deviceScaleFactor: Number.parseInt(process.env.PDF_PAGE_DEVICE_SCALE_FACTOR || '1', 10),
};

const pdfRenderQueue = new PQueue({
    concurrency: pdfQueueConcurrency,
    autoStart: true
});

let sharedBrowser = null;
let sharedBrowserPromise = null;
let browserShutdownHooksRegistered = false;

const getPuppeteerLaunchOptions = () => {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN || undefined;

    return {
        // The regular Chromium headless mode supports Page.printToPDF reliably.
        // chrome-headless-shell can render pages but has intermittent print failures
        // with header/footer templates on some Chromium builds.
        headless: "new",
        executablePath,
        timeout: pdfBrowserLaunchTimeout,
        protocolTimeout: Number.parseInt(process.env.PDF_PROTOCOL_TIMEOUT_MS || '120000', 10),
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
            "--disable-background-networking",
            "--disable-background-timer-throttling",
            "--disable-breakpad",
            "--disable-component-update",
            "--disable-domain-reliability",
            "--disable-extensions",
            "--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process",
            "--disable-renderer-backgrounding",
            "--disable-sync",
            "--metrics-recording-only",
            "--mute-audio",
            "--no-first-run",
            "--password-store=basic",
            "--use-mock-keychain",
            "--font-render-hinting=none"
        ]
    };
};

const runWithTimeout = async (task, timeoutMs, label) => {
    let timer;

    try {
        return await Promise.race([
            task(),
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error(`${label} timed out after ${timeoutMs}ms`));
                }, timeoutMs);
                timer.unref?.();
            })
        ]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
};

const maybeRunPdfMemoryCleanup = () => {
    const used = process.memoryUsage();
    if (global.gc && used.heapUsed > pdfMemoryCleanupThresholdMb * 1024 * 1024) {
        global.gc();
    }
};

const updatePdfMetrics = (partialMetrics = {}) => {
    if (!global.performanceMetrics?.pdf) {
        return;
    }

    global.performanceMetrics.pdf = {
        ...global.performanceMetrics.pdf,
        ...partialMetrics,
        queueDepth: pdfRenderQueue.size + pdfRenderQueue.pending,
    };
};

const normalizePdfMarkup = (value) => String(value ?? "").trim();
const hasPdfMarkup = (value) => normalizePdfMarkup(value).length > 0;
const finitePdfNumber = (value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const closeBrowserSafely = async (browser) => {
    if (!browser) {
        return;
    }

    try {
        await browser.close();
    } catch (closeError) {
        console.error('Error closing Puppeteer browser:', closeError.message);
    }
};

const closePageSafely = async (page) => {
    if (!page || page.isClosed()) {
        return;
    }

    try {
        await page.close({ runBeforeUnload: false });
    } catch (closeError) {
        console.error('Error closing Puppeteer page:', closeError.message);
    }
};

const registerBrowserShutdownHooks = () => {
    if (browserShutdownHooksRegistered) {
        return;
    }

    browserShutdownHooksRegistered = true;

    const shutdown = () => {
        closeBrowserSafely(sharedBrowser).finally(() => {
            sharedBrowser = null;
            sharedBrowserPromise = null;
        });
    };

    process.once('beforeExit', shutdown);
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    process.once('disconnect', shutdown);
};

const getSharedBrowser = async () => {
    if (sharedBrowser?.connected) {
        return sharedBrowser;
    }

    if (!sharedBrowserPromise) {
        sharedBrowserPromise = puppeteer.launch(getPuppeteerLaunchOptions())
            .then((browser) => {
                sharedBrowser = browser;
                registerBrowserShutdownHooks();
                browser.on('disconnected', () => {
                    sharedBrowser = null;
                    sharedBrowserPromise = null;
                });
                return browser;
            })
            .catch((error) => {
                sharedBrowser = null;
                sharedBrowserPromise = null;
                throw error;
            });
    }

    return sharedBrowserPromise;
};

const withQueuedPdfPage = async (label, task) => {
    const queueEnqueueTime = Date.now();
    updatePdfMetrics();

    return await pdfRenderQueue.add(async () => {
        let page;
        try {
            updatePdfMetrics({
                lastQueueWaitMs: Date.now() - queueEnqueueTime,
            });

            return await runWithTimeout(async () => {
                const browser = await getSharedBrowser();
                page = await browser.newPage();
                await page.setDefaultNavigationTimeout(pdfContentLoadTimeout);
                await page.setDefaultTimeout(pdfContentLoadTimeout);
                await page.setCacheEnabled(false);
                await page.setViewport(pdfPageViewport);
                return await task(page);
            }, pdfRenderTaskTimeout, label);
        } catch (error) {
            const isTimeout = /timed out/i.test(error.message || "");
            updatePdfMetrics({
                failures: (global.performanceMetrics?.pdf?.failures || 0) + 1,
                timeouts: isTimeout ? (global.performanceMetrics?.pdf?.timeouts || 0) + 1 : (global.performanceMetrics?.pdf?.timeouts || 0),
            });
            throw error;
        } finally {
            await closePageSafely(page);
            maybeRunPdfMemoryCleanup();
            updatePdfMetrics();
        }
    });
};

const waitForPdfDocumentReady = async (page) => {
    await page.setDefaultNavigationTimeout(pdfContentLoadTimeout);
    await page.setDefaultTimeout(pdfContentLoadTimeout);
    await page.emulateMediaType('screen');
    await page.evaluate(async () => {
        if (document.fonts?.ready) {
            await document.fonts.ready;
        }
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    });
};

// Chromium's PDF header/footer API accepts an HTML fragment, not a complete
// document. Complete html/head/body wrappers and remote @import rules can make
// Page.printToPDF fail even when the report itself is valid.
const normalizePdfTemplate = (template) => String(template ?? '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?(?:html|head|body)(?:\s[^>]*)?>/gi, '')
    .replace(/@import\s+url\([^;]+;\s*/gi, '')
    .trim();

const renderPdfWithFallback = async (page, options, label = 'PDF') => {
    const safeOptions = {
        ...options,
        headerTemplate: normalizePdfTemplate(options.headerTemplate),
        footerTemplate: normalizePdfTemplate(options.footerTemplate),
    };

    try {
        return await page.pdf(safeOptions);
    } catch (error) {
        const message = String(error?.message || error);
        if (!/Page\.printToPDF|Printing failed/i.test(message)) {
            throw error;
        }

        // Chromium may reject a header/footer template even though the document
        // itself is printable. Retry once with a conservative page configuration
        // so report download still works instead of returning a 500 response.
        console.warn(`${label}: printToPDF failed; retrying without header/footer`, message);
        await page.emulateMediaType('screen');
        return await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: false,
            displayHeaderFooter: false,
            margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
        });
    }
};

const inlinePdfHtmlSegments = async ({ htmlContent = "", header = "", footer = "" }) => {
    const [inlinedHtmlContent, inlinedHeader, inlinedFooter] = await Promise.all([
        convertImagesInHtmlToBase64(htmlContent),
        convertImagesInHtmlToBase64(header),
        convertImagesInHtmlToBase64(footer)
    ]);

    return {
        htmlContent: inlinedHtmlContent,
        header: inlinedHeader,
        footer: inlinedFooter
    };
};

const flattenPdfToSecureBuffer = async (inputPdfBuffer) => {
    if (!inputPdfBuffer?.length) {
        throw new Error('Input PDF buffer is empty');
    }

    const sourceBytes = inputPdfBuffer instanceof Uint8Array
        ? inputPdfBuffer
        : new Uint8Array(inputPdfBuffer);

    const loadingTask = pdfjsLib.getDocument({
        data: sourceBytes,
        disableWorker: true,
        isEvalSupported: false,
        useSystemFonts: false,
        useWorkerFetch: false,
        standardFontDataUrl: securePdfStandardFontDataUrl,
    });

    const flattenStart = Date.now();
    const sourcePdf = await loadingTask.promise;
    const flattenedPdf = await PDFDocument.create();
    const useJpeg = securePdfImageFormat === 'jpg' || securePdfImageFormat === 'jpeg';

    for (let pageNumber = 1; pageNumber <= sourcePdf.numPages; pageNumber++) {
        const sourcePage = await sourcePdf.getPage(pageNumber);
        const baseViewport = sourcePage.getViewport({ scale: 1 });
        const renderViewport = sourcePage.getViewport({ scale: securePdfRenderScale });

        const canvas = createCanvas(
            Math.ceil(renderViewport.width),
            Math.ceil(renderViewport.height)
        );
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.textRendering = 'geometricPrecision';

        await sourcePage.render({
            canvasContext: context,
            viewport: renderViewport,
        }).promise;

        const imageBuffer = useJpeg
            ? canvas.toBuffer('image/jpeg', { quality: securePdfJpegQuality, progressive: false, chromaSubsampling: false })
            : canvas.toBuffer('image/png');

        const embeddedImage = useJpeg
            ? await flattenedPdf.embedJpg(imageBuffer)
            : await flattenedPdf.embedPng(imageBuffer);

        const flattenedPage = flattenedPdf.addPage([baseViewport.width, baseViewport.height]);
        flattenedPage.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: baseViewport.width,
            height: baseViewport.height,
        });

        canvas.width = 0;
        canvas.height = 0;
    }

    const flattenedBuffer = Buffer.from(await flattenedPdf.save());
    updatePdfMetrics({
        lastFlattenMs: Date.now() - flattenStart,
        lastPdfSizeBytes: flattenedBuffer.length,
    });
    return flattenedBuffer;
};

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
            // console.log('No background image URL provided, proceeding with blank background');
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
        console.error('Error fetching image:', error.message || error);
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

const resolveUserPdfContext = async ({ value1, bookingId, tenantId }) => {
    const reportSelect = 'tenantId bookingId';
    let reportContext = null;

    if (bookingId) {
        reportContext = await reports.findOne({ bookingId }).select(reportSelect).lean();
    }

    if (!reportContext && value1 && mongoose.Types.ObjectId.isValid(value1)) {
        reportContext = await reports.findOne({ _id: value1 }).select(reportSelect).lean();
    }

    if (!reportContext && value1) {
        reportContext = await reports.findOne({ bookingId: value1 }).select(reportSelect).lean();
    }

    return {
        reportContext,
        resolvedReportId: reportContext?._id || value1 || "",
        resolvedTenantId: tenantId || reportContext?.tenantId || "",
        resolvedBookingId: bookingId || reportContext?.bookingId || value1 || "",
    };
};

const resolveLetterheadBackgroundImage = async ({ tenantId, backgroundImageUrl, customizationBackgroundImageUrl }) => {
    const directBackground = String(backgroundImageUrl ?? "").trim();
    if (directBackground) {
        return directBackground;
    }

    const savedBackground = String(customizationBackgroundImageUrl ?? "").trim();
    if (savedBackground) {
        return savedBackground;
    }

    if (!tenantId) {
        return "";
    }

    const templateDoc = await Template.findOne({ tenantId }).select("template").lean();
    return String(templateDoc?.template ?? "").trim();
};

const pdfgeneratorcontroller2 = async ({ pdfformat, layerone, tenantId, bookingId, showInvest, BoldRow, HLinred, HighLow, RowSpacing,
    selectedFontSize, reportId, htmlContent,
    cssContent, header, footer, backgroundImageUrl, headermargin, footermargin, marginRight,
    marginLeft, investigationmargin, showlab, showdoctorfirst,
    showdoctorsecond, fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext, bookingId: requestBookingId,
    fileInputDoctorlefttext, fileInputDoctorrighttext, DownloadPdf, res }) => {

    investigationmargin = finitePdfNumber(investigationmargin, 40, { max: 500 }) + 20;

    const format3 = pdfformat === "reportFormat3" ? true : false;

    const cmToPx = (cm) => cm * 37.795;

    let headermarginPx;
    let footermarginPx;
    let marginRightPx;
    let marginLeftPx;

    // Conversion from cm to px
    if (marginRight || marginLeft) {
        marginRightPx = cmToPx(finitePdfNumber(marginRight, 0, { max: 10 }));
        marginLeftPx = cmToPx(finitePdfNumber(marginLeft, 0, { max: 10 }));
    }

    headermarginPx = cmToPx(finitePdfNumber(headermargin, 2.8, { max: 10 }));
    footermarginPx = cmToPx(finitePdfNumber(footermargin, 1, { max: 10 }));

    try {
        const inlinedSegments = await inlinePdfHtmlSegments({ htmlContent, header, footer });
        htmlContent = inlinedSegments.htmlContent;
        header = inlinedSegments.header;
        footer = inlinedSegments.footer;

        const pdfBuffer = await withQueuedPdfPage(`report-pdf:${reportId}`, async (page) => {
            const contentWithCssAndImage = `
            <html>
                <head>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
                        *, *::before, *::after, html, body, table, tr, th, td, div, span, input, button, textarea, select, p, h1, h2, h3, h4, h5, h6 {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                            -webkit-font-smoothing: antialiased;
                            -moz-osx-font-smoothing: grayscale;
                            text-rendering: optimizeLegibility;
                        }
                     *{
                                margin: 0px;
                                padding: 0px;
                                box-sizing: border-box;
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
                        color: ${HLinred ? 'red' : 'black'} !important;
                        }
                        .BoldRow {
                        font-weight: ${BoldRow ? 'bold' : '400'} !important; 
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

            await page.setContent(contentWithCssAndImage, { waitUntil: 'domcontentloaded', timeout: pdfContentLoadTimeout });
            await waitForPdfDocumentReady(page);

            const renderStart = Date.now();
            const renderedPdf = await renderPdfWithFallback(page, {
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: `
                <html>
                    <head>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
                            *, *::before, *::after, html, body, table, tr, th, td, div, span, input, button, textarea, select, p, h1, h2, h3, h4, h5, h6 {
                                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                                -webkit-font-smoothing: antialiased;
                                -moz-osx-font-smoothing: grayscale;
                                text-rendering: optimizeLegibility;
                            }
                            *{
                                margin: 0px;
                                padding: 0px;
                                box-sizing: border-box;
                            }
                            .pdf-header-div {
                                width: ${format3 ? "100%" : "95%"}; 
                                margin:  0 auto;
                                border: ${(format3) ? "none" : "1px solid black"};
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
                            @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
                            *, *::before, *::after, html, body, table, tr, th, td, div, span, input, button, textarea, select, p, h1, h2, h3, h4, h5, h6 {
                                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                                -webkit-font-smoothing: antialiased;
                                -moz-osx-font-smoothing: grayscale;
                                text-rendering: optimizeLegibility;
                            }
                         *{
                                margin: 0px;
                                padding: 0px;
                                box-sizing: border-box;
                            }
                            ${cssContent}
                            .pdf-footer-div {
                            width: 92%; 
                            display: flex;
                            justify-content: center;
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
                    ${footer}
                </div>
                    </body>
                </html>`,
                margin: { top: `${headermarginPx + (format3 ? ((investigationmargin * 1.10) + (layerone ? (investigationmargin < 110 ? 75 : 15) : (investigationmargin < 160 ? 55 : 0))) : ((investigationmargin * 0.90) + (layerone ? 10 : 0)))}px`, bottom: '175px', left: `10px`, right: `10px` },
            });
            updatePdfMetrics({ lastRenderMs: Date.now() - renderStart, lastPdfSizeBytes: renderedPdf.length });
            return renderedPdf;
        });

        const finalPdfBuffer = await addBackgroundToPdf(pdfBuffer, backgroundImageUrl);

        if (!finalPdfBuffer) {
            console.error('Final PDF buffer is null');
            res.status(500).send('Failed to generate final PDF');
            return;
        }

        const finalpdfbufferwithmargin = await adjustPdfMargins(finalPdfBuffer, marginRightPx, marginLeftPx);

        // ✅ FIX: Attach uploaded files from "All Cases" to the end of the PDF
        const attachmentAwareBuffer = await mergePdfWithBookingAttachments({
            pdfBuffer: finalpdfbufferwithmargin,
            tenantId,
            bookingId,
            reportId
        });

        let responsePdfBuffer = attachmentAwareBuffer;

        if (enforceSecureReportPdf) {
            responsePdfBuffer = await flattenPdfToSecureBuffer(attachmentAwareBuffer);
        }


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
            { tenantId, bookingId }, // Query by tenantId and bookingId
            updateData,
            {
                new: true,  // Return the updated document
                upsert: true, // Create new record if it doesn't exist
            }
        );


        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="final_report.pdf"');
        res.setHeader('Content-Length', responsePdfBuffer.length);
        res.end(responsePdfBuffer);

    } catch (error) {
        console.error('Error generating final PDF:', error.message);
        res.status(500).send('Error generating final PDF');
    }
}
const pdfgeneratorcontroller3 = async ({ pdfformat, layerone, tenantId, bookingId, showInvest, BoldRow, HLinred, HighLow, RowSpacing,
    selectedFontSize, reportId, htmlContent,
    cssContent, header, footer, backgroundImageUrl, headermargin, footermargin, marginRight,
    marginLeft, investigationmargin, showlab, showdoctorfirst,
    showdoctorsecond, fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext,
    fileInputDoctorlefttext, fileInputDoctorrighttext, DownloadPdf, res }) => {

    investigationmargin = parseFloat(investigationmargin) + 20;

    const format3 = pdfformat === "reportFormat3" ? true : false;

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

    try {
        const inlinedSegments = await inlinePdfHtmlSegments({ htmlContent, header, footer });
        htmlContent = inlinedSegments.htmlContent;
        header = inlinedSegments.header;
        footer = inlinedSegments.footer;

        const pdfBuffer = await withQueuedPdfPage(`report-pdf:${reportId}`, async (page) => {
            const contentWithCssAndImage = `
            <html>
                <head>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
                        *, *::before, *::after, html, body, table, tr, th, td, div, span, input, button, textarea, select, p, h1, h2, h3, h4, h5, h6 {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                            -webkit-font-smoothing: antialiased;
                            -moz-osx-font-smoothing: grayscale;
                            text-rendering: optimizeLegibility;
                        }
                     *{
                                margin: 0px;
                                padding: 0px;
                                box-sizing: border-box;
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
                        color: ${HLinred ? 'red' : 'black'} !important;
                        }
                        .BoldRow {
                        font-weight: ${BoldRow ? 'bold' : '400'} !important; 
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
                                        table {
                width: 98% !important;
                margin: 0 auto !important;
            }
                    </style>
                </head>
                <body>
                    <div class="middle">
                    ${htmlContent}
                    </div>
                </body>
            </html>`;

            await page.setContent(contentWithCssAndImage, { waitUntil: 'domcontentloaded', timeout: pdfContentLoadTimeout });
            await waitForPdfDocumentReady(page);

            const renderStart = Date.now();
            const renderedPdf = await renderPdfWithFallback(page, {
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: `
                <html>
                    <head>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
                            *, *::before, *::after, html, body, table, tr, th, td, div, span, input, button, textarea, select, p, h1, h2, h3, h4, h5, h6 {
                                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                                -webkit-font-smoothing: antialiased;
                                -moz-osx-font-smoothing: grayscale;
                                text-rendering: optimizeLegibility;
                            }
                            *{
                                margin: 0px;
                                padding: 0px;
                                box-sizing: border-box;
                            }
                            .pdf-header-div {
                                width: 95%; 
                                margin:  0 auto;
                                margin-top: ${format3 ? "0" : headermargin}cm !important;
                            }
                            .report-details-innerDiv2 {
                            width: 100%;
                            font-size: 12px;
                            }
                            #investDiv {
                            display: ${showInvest ? 'flex' : 'none'} !important;
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
                            @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
                            *, *::before, *::after, html, body, table, tr, th, td, div, span, input, button, textarea, select, p, h1, h2, h3, h4, h5, h6 {
                                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                                -webkit-font-smoothing: antialiased;
                                -moz-osx-font-smoothing: grayscale;
                                text-rendering: optimizeLegibility;
                            }
                         *{
                                margin: 0px;
                                padding: 0px;
                                box-sizing: border-box;
                            }
                            ${cssContent}
                            .pdf-footer-div {
                            width: 92%; 
                            display: flex;
                            justify-content: center;
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
                    ${footer}
                </div>
                    </body>
                </html>`,
                margin: { top: `${headermarginPx + (format3 ? ((investigationmargin * 1.10) + (layerone ? (investigationmargin < 110 ? 75 : 15) : (investigationmargin < 160 ? 55 : 0))) : ((investigationmargin * 0.90) + (layerone ? 10 : 0)))}px`, bottom: '175px', left: `10px`, right: `10px` },
                margin: { top: `${headermarginPx + investigationmargin - 40}px`, bottom: '175px', left: `10px`, right: `10px` },
            });
            updatePdfMetrics({ lastRenderMs: Date.now() - renderStart, lastPdfSizeBytes: renderedPdf.length });
            return renderedPdf;
        });

        const finalPdfBuffer = await addBackgroundToPdf(pdfBuffer, backgroundImageUrl);

        if (!finalPdfBuffer) {
            console.error('Final PDF buffer is null');
            res.status(500).send('Failed to generate final PDF');
            return;
        }

        const finalpdfbufferwithmargin = await adjustPdfMargins(finalPdfBuffer, marginRightPx, marginLeftPx);

        // ✅ FIX: Attach uploaded files from "All Cases" to the end of the PDF
        const attachmentAwareBuffer = await mergePdfWithBookingAttachments({
            pdfBuffer: finalpdfbufferwithmargin,
            tenantId,
            bookingId,
            reportId
        });

        let responsePdfBuffer = attachmentAwareBuffer;

        if (enforceSecureReportPdf) {
            responsePdfBuffer = await flattenPdfToSecureBuffer(attachmentAwareBuffer);
        }


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
            { tenantId, bookingId }, // Query by tenantId and bookingId
            updateData,
            {
                new: true,  // Return the updated document
                upsert: true, // Create new record if it doesn't exist
            }
        );


        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="final_report.pdf"');
        res.setHeader('Content-Length', responsePdfBuffer.length);
        res.end(responsePdfBuffer);

    } catch (error) {
        console.error('Error generating final PDF:', error.message);
        console.error('Error generating final PDF:', error.message, error.stack);
        res.status(500).send('Error generating final PDF');
    }
}

const getpdfcontroller = async (req, res) => {

    const { value1, checkBox, htmlContent, cssContent, header, footer, backgroundImageUrl,
        headermargin, footermargin, marginRight, marginLeft, selectedFontSize, RowSpacing, HighLow,
        HLinred, BoldRow, showInvest, DownloadPdf, investigationmargin, showlab, showdoctorfirst,
        showdoctorsecond, fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext,
        fileInputDoctorlefttext, fileInputDoctorrighttext, bookingId, format } = req.body;

    let pdfformat;
    const tid = req.user.tenantId._id;
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }

    if (req.user.role === "admin") {
        pdfformat = req.user.pdfFormat;
    } else {
        pdfformat = req.user.createdBy.pdfFormat;
    }

    try {
        // Attempt to fetch data from the database
        const pdfContext = await resolveUserPdfContext({ value1, bookingId, tenantId: tid });
        const gettingcustomization = await customization.findOne({ tenantId: tid, bookingId: pdfContext.resolvedBookingId });
        // console.log("Fetched customization from DB:", gettingcustomization);
        const resolvedBackgroundImageUrl = await resolveLetterheadBackgroundImage({
            tenantId: tid,
            backgroundImageUrl,
            customizationBackgroundImageUrl: gettingcustomization?.backgroundImageUrl,
        });

        const defaultpdfsetting = await saveOrUpdatePdfSetting({
            tenantId: tid,
            createdBy: userId,
            headermargin,
            footermargin,
            marginRight,
            marginLeft,
            investigationmargin,
            showInvest,
            BoldRow,
            HLinred,
            HighLow,
            RowSpacing,
            selectedFontSize,
        })

        let mergedValues;

        if (checkBox || DownloadPdf) {
            // Define fallback logic to prioritize database values first
            mergedValues = {
                pdfformat: pdfformat,
                tenantId: pdfContext.resolvedTenantId || tid, // ✅ Added tenantId
                showInvest: defaultpdfsetting?.showInvest ?? gettingcustomization?.showInvest ?? true, // Updated logic
                BoldRow: defaultpdfsetting?.BoldRow ?? gettingcustomization?.BoldRow ?? true, // Updated logic     
                HLinred: defaultpdfsetting?.HLinred ?? gettingcustomization?.HLinred ?? false, // Updated logic     
                HighLow: defaultpdfsetting?.HighLow ?? gettingcustomization?.HighLow ?? false, // Updated logic     
                RowSpacing: defaultpdfsetting?.RowSpacing || gettingcustomization?.RowSpacing || 7,
                selectedFontSize: defaultpdfsetting.selectedFontSize || gettingcustomization.selectedFontSize || 12,
                reportId: pdfContext.resolvedReportId,
                bookingId: pdfContext.resolvedBookingId || gettingcustomization?.bookingId || "",
                htmlContent: htmlContent || gettingcustomization?.htmlContent || "", // Priority: Database > Request > Default
                cssContent: cssContent || gettingcustomization?.cssContent || "",
                header: header || gettingcustomization?.header || "",
                footer: footer || gettingcustomization?.footer || "",
                backgroundImageUrl: "",
                headermargin: defaultpdfsetting?.headermargin || gettingcustomization?.headermargin || "2.8",
                footermargin: defaultpdfsetting?.footermargin || gettingcustomization?.footermargin || "1",
                marginRight: defaultpdfsetting?.marginRight || gettingcustomization?.marginRight || "0",
                marginLeft: defaultpdfsetting?.marginLeft || gettingcustomization?.marginLeft || "0",
                investigationmargin: defaultpdfsetting?.investigationmargin || gettingcustomization?.investigationmargin || 40,
                showlab: showlab ?? gettingcustomization?.showlab ?? false,
                showdoctorfirst: showdoctorfirst ?? gettingcustomization?.showdoctorfirst ?? true,
                showdoctorsecond: showdoctorsecond ?? gettingcustomization?.showdoctorsecond ?? true,
                fileInputLab: fileInputLab || gettingcustomization?.fileInputLab || "",
                fileInputDoctorleft: fileInputDoctorleft || gettingcustomization?.fileInputDoctorleft || "",
                fileInputDoctorright: fileInputDoctorright || gettingcustomization?.fileInputDoctorright || "",
                fileInputLabtext: fileInputLabtext || gettingcustomization?.fileInputLabtext || "",
                fileInputDoctorlefttext: fileInputDoctorlefttext || gettingcustomization?.fileInputDoctorlefttext || "",
                fileInputDoctorrighttext: fileInputDoctorrighttext || gettingcustomization?.fileInputDoctorrighttext || "",
                DownloadPdf: Boolean(DownloadPdf),
                format: format || gettingcustomization?.format || "",
                res
            };
        } else {
            // Define fallback logic to prioritize database values first
            mergedValues = {
                pdfformat: pdfformat,
                tenantId: pdfContext.resolvedTenantId || tid, // ✅ Added tenantId
                showInvest: defaultpdfsetting?.showInvest ?? gettingcustomization?.showInvest ?? true, // Updated logic
                BoldRow: defaultpdfsetting?.BoldRow ?? gettingcustomization?.BoldRow ?? true, // Updated logic     
                HLinred: defaultpdfsetting?.HLinred ?? gettingcustomization?.HLinred ?? false, // Updated logic     
                HighLow: defaultpdfsetting?.HighLow ?? gettingcustomization?.HighLow ?? false, // Updated logic     
                RowSpacing: defaultpdfsetting?.RowSpacing || gettingcustomization?.RowSpacing || 7,
                selectedFontSize: defaultpdfsetting.selectedFontSize || gettingcustomization.selectedFontSize || 12,
                reportId: pdfContext.resolvedReportId,
                bookingId: pdfContext.resolvedBookingId || gettingcustomization?.bookingId || "",
                htmlContent: htmlContent || gettingcustomization?.htmlContent || "", // Priority: Request > Database > Default
                cssContent: cssContent || gettingcustomization?.cssContent || "",
                header: header || gettingcustomization?.header || "",
                footer: footer || gettingcustomization?.footer || "",
                backgroundImageUrl: resolvedBackgroundImageUrl,
                headermargin: defaultpdfsetting?.headermargin || gettingcustomization?.headermargin || "2.8",
                footermargin: defaultpdfsetting?.footermargin || gettingcustomization?.footermargin || "1",
                marginRight: defaultpdfsetting?.marginRight || gettingcustomization?.marginRight || "0",
                marginLeft: defaultpdfsetting?.marginLeft || gettingcustomization?.marginLeft || "0",
                investigationmargin: defaultpdfsetting?.investigationmargin || gettingcustomization?.investigationmargin || 40,
                showlab: showlab ?? gettingcustomization?.showlab ?? false,
                showdoctorfirst: showdoctorfirst ?? gettingcustomization?.showdoctorfirst ?? true,
                showdoctorsecond: showdoctorsecond ?? gettingcustomization?.showdoctorsecond ?? true,
                fileInputLab: fileInputLab || gettingcustomization?.fileInputLab || "",
                fileInputDoctorleft: fileInputDoctorleft || gettingcustomization?.fileInputDoctorleft || "",
                fileInputDoctorright: fileInputDoctorright || gettingcustomization?.fileInputDoctorright || "",
                fileInputLabtext: fileInputLabtext || gettingcustomization?.fileInputLabtext || "",
                fileInputDoctorlefttext: fileInputDoctorlefttext || gettingcustomization?.fileInputDoctorlefttext || "",
                fileInputDoctorrighttext: fileInputDoctorrighttext || gettingcustomization?.fileInputDoctorrighttext || "",
                DownloadPdf: Boolean(DownloadPdf),
                format: format || gettingcustomization?.format || "",
                res
            };
        }

        if (req.user.tenantId.modelType === "1layer") {
            mergedValues.showInvest = false;
            mergedValues.layerone = true;
        }

        if (mergedValues.pdfformat === "reportFormat4") {
            await pdfgeneratorcontroller3(mergedValues);
            return;
        }

        // Generate the PDF with merged values
        await pdfgeneratorcontroller2(mergedValues);

    } catch (error) {
        console.error('Error fetching PDF:', error.message);
        res.status(500).json({ message: 'Error fetching PDF', error: error.message });
    }
};

const saveOrUpdatePdfSetting = async ({
    tenantId,
    createdBy,
    headermargin,
    footermargin,
    marginRight,
    marginLeft,
    investigationmargin,
    showInvest,
    BoldRow,
    HLinred,
    HighLow,
    RowSpacing,
    selectedFontSize,
}) => {
    try {
        // tenantId के आधार पर रिकॉर्ड खोजें
        let existingSetting = await defaultpdfsetting.findOne({ tenantId });

        if (!existingSetting) {
            // अगर नहीं मिला तो नया डॉक्यूमेंट बनाएँ
            const newSetting = await defaultpdfsetting.create({
                tenantId,
                createdBy,
                headermargin,
                footermargin,
                marginRight,
                marginLeft,
                investigationmargin,
                showInvest,
                BoldRow,
                HLinred,
                HighLow,
                RowSpacing,
                selectedFontSize,
            });

            return newSetting;
        } else {
            // अगर मिला तो सिर्फ बदले हुए फ़ील्ड्स अपडेट करें
            let isChanged = false;

            const fields = {
                headermargin,
                footermargin,
                marginRight,
                marginLeft,
                investigationmargin,
                showInvest,
                BoldRow,
                HLinred,
                HighLow,
                RowSpacing,
                selectedFontSize,
            };

            for (let key in fields) {
                if (
                    fields[key] !== undefined &&
                    fields[key] !== existingSetting[key]
                ) {
                    existingSetting[key] = fields[key];
                    isChanged = true;
                }
            }

            if (isChanged) {
                await existingSetting.save();
                return existingSetting;
            } else {
                return existingSetting;
            }
        }
    } catch (error) {
        console.error(error.message);
        throw new Error("Server Error");

    }
};

// Backend API endpoint for merging PDFs
const mergePdfsController = async (req, res) => {
    const { reportIds, checkBox } = req.body;

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length < 2) {
        return res.status(400).json({
            message: 'Please provide at least 2 report IDs to merge'
        });
    }

    try {
        // Create a new PDF document
        const mergedPdf = await PDFDocument.create();

        // Loop through each reportId and generate PDF
        for (let reportId of reportIds) {
            try {
                // Fetch customization for this report
                const gettingcustomization = await customization.findOne({ reportId });

                const tid = req.user.tenantId._id;
                let userId;
                if (req.user.role === 'staff') {
                    userId = req.user.parentUser;
                } else {
                    userId = req.user._id;
                }

                const defaultpdfsetting = await saveOrUpdatePdfSetting({
                    tenantId: tid,
                    createdBy: userId,
                });

                // Prepare merged values
                const mergedValues = {
                    showInvest: defaultpdfsetting?.showInvest ?? gettingcustomization?.showInvest ?? true,
                    BoldRow: defaultpdfsetting?.BoldRow ?? gettingcustomization?.BoldRow ?? true,
                    HLinred: defaultpdfsetting?.HLinred ?? gettingcustomization?.HLinred ?? false,
                    HighLow: defaultpdfsetting?.HighLow ?? gettingcustomization?.HighLow ?? false,
                    RowSpacing: defaultpdfsetting?.RowSpacing || gettingcustomization?.RowSpacing || 7,
                    selectedFontSize: defaultpdfsetting?.selectedFontSize || gettingcustomization?.selectedFontSize || 12,
                    reportId: reportId,
                    htmlContent: gettingcustomization?.htmlContent || "",
                    cssContent: gettingcustomization?.cssContent || "",
                    header: gettingcustomization?.header || "",
                    footer: gettingcustomization?.footer || "",
                    backgroundImageUrl: checkBox ? "" : (gettingcustomization?.backgroundImageUrl || ""),
                    headermargin: defaultpdfsetting?.headermargin || gettingcustomization?.headermargin || "2.8",
                    footermargin: defaultpdfsetting?.footermargin || gettingcustomization?.footermargin || "1",
                    marginRight: defaultpdfsetting?.marginRight || gettingcustomization?.marginRight || "0",
                    marginLeft: defaultpdfsetting?.marginLeft || gettingcustomization?.marginLeft || "0",
                    investigationmargin: defaultpdfsetting?.investigationmargin || gettingcustomization?.investigationmargin || 40,
                    showlab: gettingcustomization?.showlab ?? false,
                    showdoctorfirst: gettingcustomization?.showdoctorfirst ?? true,
                    showdoctorsecond: gettingcustomization?.showdoctorsecond ?? true,
                    fileInputLab: gettingcustomization?.fileInputLab || "",
                    fileInputDoctorleft: gettingcustomization?.fileInputDoctorleft || "",
                    fileInputDoctorright: gettingcustomization?.fileInputDoctorright || "",
                    fileInputLabtext: gettingcustomization?.fileInputLabtext || "",
                    fileInputDoctorlefttext: gettingcustomization?.fileInputDoctorlefttext || "",
                    fileInputDoctorrighttext: gettingcustomization?.fileInputDoctorrighttext || "",
                };

                // Generate individual PDF buffer
                const pdfBuffer = await generateSinglePdfBuffer(mergedValues, req.user);

                // Load the PDF
                const pdf = await PDFDocument.load(pdfBuffer);

                // Copy all pages from this PDF to the merged PDF
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => {
                    mergedPdf.addPage(page);
                });

            } catch (error) {
                console.error(`Error processing report ${reportId}:`, error);
                // Continue with other reports even if one fails
            }
        }

        // Save the merged PDF
        const mergedPdfBytes = await mergedPdf.save();

        // Send the merged PDF as response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="merged_reports.pdf"');
        res.setHeader('Content-Length', mergedPdfBytes.length);
        res.end(Buffer.from(mergedPdfBytes));

    } catch (error) {
        console.error('Error merging PDFs:', error);
        res.status(500).json({
            message: 'Error merging PDFs',
            error: error.message
        });
    }
};

// Helper function to generate single PDF buffer
async function generateSinglePdfBuffer(mergedValues, user) {

    let pdfformat;
    if (user.role === "admin") {
        pdfformat = user.pdfFormat;
    } else {
        pdfformat = user.createdBy.pdfFormat;
    }

    const format3 = pdfformat === "reportFormat3" ? true : false;
    const layerone = user.tenantId.modelType === "1layer";

    if (layerone) {
        mergedValues.showInvest = false;
    }

    const cmToPx = (cm) => cm * 37.795;

    const headermarginPx = cmToPx(finitePdfNumber(mergedValues.headermargin, 2.8, { max: 10 }));
    const footermarginPx = cmToPx(finitePdfNumber(mergedValues.footermargin, 1, { max: 10 }));
    const marginRightPx = cmToPx(finitePdfNumber(mergedValues.marginRight, 0, { max: 10 }));
    const marginLeftPx = cmToPx(finitePdfNumber(mergedValues.marginLeft, 0, { max: 10 }));

    const inlinedSegments = await inlinePdfHtmlSegments({
        htmlContent: mergedValues.htmlContent,
        header: mergedValues.header,
        footer: mergedValues.footer
    });

    const pdfBuffer = await withQueuedPdfPage(`merge-report-pdf:${mergedValues.reportId}`, async (page) => {
        const contentWithCssAndImage = `
        <html>
            <head>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
                    *, *::before, *::after, html, body, table, tr, th, td, div, span, input, button, textarea, select, p, h1, h2, h3, h4, h5, h6 {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                        text-rendering: optimizeLegibility;
                    }
                    *{
                        margin: 0px;
                        padding: 0px;
                        box-sizing: border-box;
                    }
                    ${mergedValues.cssContent}
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
                        font-size: ${mergedValues.selectedFontSize}px !important;
                    }
                    td {
                        padding-top: ${parseFloat(mergedValues.RowSpacing) / 2}px !important;
                        padding-bottom: ${parseFloat(mergedValues.RowSpacing) / 2}px !important;
                    }
                    td .HL span {
                        display: ${mergedValues.HighLow ? 'block' : 'none'};
                    }
                    .high-low span{
                        color: ${mergedValues.HLinred ? 'red' : 'black'} !important;
                    }
                    .BoldRow {
                        font-weight: ${mergedValues.BoldRow ? 'bold' : '400'} !important; 
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
                ${inlinedSegments.htmlContent}
                </div>
            </body>
        </html>`;

        await page.setContent(contentWithCssAndImage, { waitUntil: 'domcontentloaded', timeout: pdfContentLoadTimeout });
        await waitForPdfDocumentReady(page);

        const renderStart = Date.now();
        const renderedPdf = await renderPdfWithFallback(page, {
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: `
            <html>
                <head>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
                        *, *::before, *::after, html, body, table, tr, th, td, div, span, input, button, textarea, select, p, h1, h2, h3, h4, h5, h6 {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                            -webkit-font-smoothing: antialiased;
                            -moz-osx-font-smoothing: grayscale;
                            text-rendering: optimizeLegibility;
                        }
                        *{
                            margin: 0px;
                            padding: 0px;
                            box-sizing: border-box;
                        }
                        .pdf-header-div {
                            width: ${format3 ? "100%" : "95%"}; 
                            margin: 0 auto;
                            border: ${format3 ? "none" : "1px solid black"};
                            margin-top: ${format3 ? "0" : mergedValues.headermargin}cm !important;
                        }
                        .report-details-innerDiv2 {
                            width: ${format3 ? "95%" : "100%"} !important;
                            font-size: 12px;
                            margin-top: ${format3 ? mergedValues.headermargin : "0"}cm !important;
                            border: none !important;
                        }
                        #investDiv {
                            display: ${mergedValues.showInvest ? 'flex' : 'none'}
                            }
                        .time-div {
                            width: 40% !important;
                        }
                    </style>
                </head>
                <body>
                    <div class="pdf-header-div"> 
                    ${inlinedSegments.header}
                </div>
                </body>
            </html>`,
            footerTemplate: `
            <html>
                <head>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
                        *, *::before, *::after, html, body, table, tr, th, td, div, span, input, button, textarea, select, p, h1, h2, h3, h4, h5, h6 {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                            -webkit-font-smoothing: antialiased;
                            -moz-osx-font-smoothing: grayscale;
                            text-rendering: optimizeLegibility;
                        }
                        *{
                            margin: 0px;
                            padding: 0px;
                            box-sizing: border-box;
                        }
                        ${mergedValues.cssContent}
                        .pdf-footer-div {
                            width: 92%; 
                            display: flex;
                            justify-content: center;
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
                ${inlinedSegments.footer}
            </div>
                </body>
            </html>`,
            margin: {
                top: `${headermarginPx + (format3 ? ((mergedValues.investigationmargin * 1.10) + (layerone ? (mergedValues.investigationmargin < 110 ? 75 : 15) : (mergedValues.investigationmargin < 160 ? 55 : 0))) : ((mergedValues.investigationmargin * 0.90) + (layerone ? 10 : 0)))}px`,
                bottom: '175px',
                left: `10px`,
                right: `10px`
            },
        });
        updatePdfMetrics({ lastRenderMs: Date.now() - renderStart, lastPdfSizeBytes: renderedPdf.length });
        return renderedPdf;
    });

    // Add background if needed
    const finalPdfBuffer = await addBackgroundToPdf(pdfBuffer, mergedValues.backgroundImageUrl);

    // Adjust margins
    const finalpdfbufferwithmargin = await adjustPdfMargins(finalPdfBuffer, marginRightPx, marginLeftPx);
    const attachmentAwarePdfBuffer = await mergePdfWithBookingAttachments({
        pdfBuffer: finalpdfbufferwithmargin,
        tenantId: mergedValues.tenantId,
        bookingId: mergedValues.bookingId,
        reportId: mergedValues.reportId,
    });

    if (enforceSecureReportPdf) {
        return flattenPdfToSecureBuffer(attachmentAwarePdfBuffer);
    }

    return attachmentAwarePdfBuffer;
}


const getpdfcontrolleruser = async (req, res) => {

    const { value1, checkBox, htmlContent, cssContent, header, footer, backgroundImageUrl,
        headermargin, footermargin, marginRight, marginLeft, selectedFontSize, RowSpacing, HighLow,
        HLinred, BoldRow, showInvest, DownloadPdf, investigationmargin, showlab, showdoctorfirst,
        showdoctorsecond, fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext,
        fileInputDoctorlefttext, fileInputDoctorrighttext, pdfFormat, layerOne, bookingId, tenantId } = req.body;

    try {
        // Attempt to fetch data from the database
        const pdfContext = await resolveUserPdfContext({ value1, bookingId, tenantId });
        const gettingcustomization = await customization.findOne({ tenantId: pdfContext.resolvedTenantId || tenantId || req.user?.tenantId?._id, bookingId: pdfContext.resolvedBookingId });
        const userPdfFormat = req.user?.role === "admin"
            ? req.user?.pdfFormat
            : req.user?.createdBy?.pdfFormat;
        const userLayerOne = req.user?.tenantId?.modelType === "1layer";
        const resolvedBackgroundImageUrl = await resolveLetterheadBackgroundImage({
            tenantId: pdfContext.resolvedTenantId || tenantId || req.user?.tenantId?._id,
            backgroundImageUrl,
            customizationBackgroundImageUrl: gettingcustomization?.backgroundImageUrl,
        });
        let mergedValues;

        if (checkBox || DownloadPdf) {
            // Define fallback logic to prioritize database values first
            mergedValues = {
                pdfformat: pdfFormat || userPdfFormat || gettingcustomization?.format || "",
                layerone: layerOne || (userLayerOne ? "1layer" : ""),
                tenantId: pdfContext.resolvedTenantId || gettingcustomization?.tenantId || "",
                bookingId: pdfContext.resolvedBookingId || gettingcustomization?.bookingId || "",
                showInvest: showInvest ?? gettingcustomization?.showInvest ?? false, // Updated logic     
                BoldRow: BoldRow ?? gettingcustomization?.BoldRow ?? false, // Updated logic     
                HLinred: HLinred ?? gettingcustomization?.HLinred ?? false, // Updated logic     
                HighLow: HighLow ?? gettingcustomization?.HighLow ?? false, // Updated logic     
                RowSpacing: RowSpacing || gettingcustomization.RowSpacing || 7,
                selectedFontSize: selectedFontSize || gettingcustomization.selectedFontSize || 12,
                reportId: pdfContext.resolvedReportId,
                htmlContent: htmlContent || gettingcustomization?.htmlContent || "", // Priority: Database > Request > Default
                cssContent: cssContent || gettingcustomization?.cssContent || "",
                header: header || gettingcustomization?.header || "",
                footer: footer || gettingcustomization?.footer || "",
                backgroundImageUrl: "",
                headermargin: headermargin || gettingcustomization?.headermargin || "2.8",
                footermargin: footermargin || gettingcustomization?.footermargin || "1",
                marginRight: marginRight || gettingcustomization?.marginRight || "0",
                marginLeft: marginLeft || gettingcustomization?.marginLeft || "0",
                investigationmargin: investigationmargin || gettingcustomization?.investigationmargin || 40,
                showlab: showlab ?? gettingcustomization?.showlab ?? false,
                showdoctorfirst: showdoctorfirst ?? gettingcustomization?.showdoctorfirst ?? true,
                showdoctorsecond: showdoctorsecond ?? gettingcustomization?.showdoctorsecond ?? true,
                fileInputLab: fileInputLab || gettingcustomization?.fileInputLab || "",
                fileInputDoctorleft: fileInputDoctorleft || gettingcustomization?.fileInputDoctorleft || "",
                fileInputDoctorright: fileInputDoctorright || gettingcustomization?.fileInputDoctorright || "",
                fileInputLabtext: fileInputLabtext || gettingcustomization?.fileInputLabtext || "",
                fileInputDoctorlefttext: fileInputDoctorlefttext || gettingcustomization?.fileInputDoctorlefttext || "",
                fileInputDoctorrighttext: fileInputDoctorrighttext || gettingcustomization?.fileInputDoctorrighttext || "",
                DownloadPdf: Boolean(DownloadPdf),
                res
            };
        } else {
            // Define fallback logic to prioritize database values first
            mergedValues = {
                pdfformat: pdfFormat || userPdfFormat || gettingcustomization?.format || "",
                layerone: layerOne || (userLayerOne ? "1layer" : ""),
                tenantId: pdfContext.resolvedTenantId || gettingcustomization?.tenantId || "",
                bookingId: pdfContext.resolvedBookingId || gettingcustomization?.bookingId || "",
                showInvest: showInvest ?? gettingcustomization?.showInvest ?? false, // Updated logic     
                BoldRow: BoldRow ?? gettingcustomization?.BoldRow ?? false, // Updated logic     
                HLinred: HLinred ?? gettingcustomization?.HLinred ?? false, // Updated logic     
                HighLow: HighLow ?? gettingcustomization?.HighLow ?? false, // Updated logic     
                RowSpacing: RowSpacing || gettingcustomization.RowSpacing || 8,
                selectedFontSize: selectedFontSize || gettingcustomization.selectedFontSize || 12,
                reportId: pdfContext.resolvedReportId,
                htmlContent: htmlContent || gettingcustomization?.htmlContent || "", // Priority: Database > Request > Default
                cssContent: cssContent || gettingcustomization?.cssContent || "",
                header: header || gettingcustomization?.header || "",
                footer: footer || gettingcustomization?.footer || "",
                backgroundImageUrl: resolvedBackgroundImageUrl,
                headermargin: headermargin || gettingcustomization?.headermargin || "2.8",
                footermargin: footermargin || gettingcustomization?.footermargin || "1",
                marginRight: marginRight || gettingcustomization?.marginRight || "0",
                marginLeft: marginLeft || gettingcustomization?.marginLeft || "0",
                investigationmargin: investigationmargin || gettingcustomization?.investigationmargin || 40,
                showlab: showlab ?? gettingcustomization?.showlab ?? false,
                showdoctorfirst: showdoctorfirst ?? gettingcustomization?.showdoctorfirst ?? true,
                showdoctorsecond: showdoctorsecond ?? gettingcustomization?.showdoctorsecond ?? true,
                fileInputLab: fileInputLab || gettingcustomization?.fileInputLab || "",
                fileInputDoctorleft: fileInputDoctorleft || gettingcustomization?.fileInputDoctorleft || "",
                fileInputDoctorright: fileInputDoctorright || gettingcustomization?.fileInputDoctorright || "",
                fileInputLabtext: fileInputLabtext || gettingcustomization?.fileInputLabtext || "",
                fileInputDoctorlefttext: fileInputDoctorlefttext || gettingcustomization?.fileInputDoctorlefttext || "",
                fileInputDoctorrighttext: fileInputDoctorrighttext || gettingcustomization?.fileInputDoctorrighttext || "",
                DownloadPdf: Boolean(DownloadPdf),
                res
            };
        }

        if (!hasPdfMarkup(mergedValues.htmlContent)) {
            return res.status(400).json({
                message: "PDF content is empty. Please wait for the report to finish loading and try again."
            });
        }

        if (layerOne === "1layer" || userLayerOne) {
            mergedValues.showInvest = false;
            mergedValues.layerone = true;
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
    let userId;
    if (req.user.role === 'staff') {
        userId = req.user.parentUser
    } else {
        userId = req.user._id
    }
    const { reportId, htmlContent, cssContent, header, footer, backgroundImageUrl,
        headermargin, footermargin, investigationmargin, showlab, showdoctorfirst,
        showdoctorsecond, fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext,
        fileInputDoctorlefttext, fileInputDoctorrighttext, bookingId } = req.body;

    // console.log("header", header, "footer", footer, "htmlcontent:", htmlContent );

    // // console.log("Received data for saving PDF customization:", header);

    // Best balance of safety + simplicity
    const vars = {
        reportId, htmlContent, cssContent, header, footer, backgroundImageUrl,
        headermargin, footermargin, investigationmargin, showlab, showdoctorfirst,
        showdoctorsecond, fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext,
        fileInputDoctorlefttext, fileInputDoctorrighttext, bookingId
    };

    if (!hasPdfMarkup(htmlContent)) {
        return res.status(400).json({
            message: "Report HTML is empty. The report has not finished loading yet."
        });
    }

    const updateFields = {};
    for (const key in vars) {
        if (vars[key] != null) updateFields[key] = vars[key];
    }
    updateFields.updatedAt = new Date();

    const getcustomization = await customization.findOneAndUpdate(
        {
            tenantId: tenantId,
            bookingId: bookingId
        }, // Or use some identifier
        updateFields,
        {
            new: true,  // Return updated document
            upsert: true, // Create new record if it doesn't exist
        }
    );

    await saveOrUpdatePdfSetting({
        tenantId,
        createdBy: userId,
        headermargin,
        footermargin,
        investigationmargin,
    })

    return res.status(200).json(getcustomization)
}

const getCustomizationByReportId = async (req, res) => {
    try {
        // Extract reportId from the request
        const { reportId } = req.body;

        if (!reportId) {
            return // console.log('pdf data not found in database')
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

    try {
        const pdfBuffer = await withQueuedPdfPage(`invoice-pdf:${bookingId || 'unknown'}`, async (page) => {
            const contentwithhtmlcss = `
        <html>
        <head>
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
        *, *::before, *::after, html, body, table, tr, th, td, div, span, input, button, textarea, select, p, h1, h2, h3, h4, h5, h6 {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
        }
        ${invoicecss}
        </style>
        </head>
        <body>
        ${invoiceHtml}
        </body>
        </html>`;

            await page.setContent(contentwithhtmlcss, { waitUntil: 'domcontentloaded', timeout: pdfContentLoadTimeout });
            await waitForPdfDocumentReady(page);

            const renderStart = Date.now();
            const renderedPdf = await renderPdfWithFallback(page, {
                format: 'A4',
                printBackground: true,
                margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
            });
            updatePdfMetrics({ lastRenderMs: Date.now() - renderStart, lastPdfSizeBytes: renderedPdf.length });
            return renderedPdf;
        });

        const document = await invoices.findOneAndUpdate(
            {
                tenantId: req.user.tenantId._id,
                createdBy: req.user._id,
                bookingId: bookingId
            },
            {
                tenantId: req.user.tenantId._id,
                createdBy: req.user._id,
                invoiceCss: invoicecss,
                invoiceHtml: invoiceHtml,
                billNumber: billnumber,
                generatedBy,
                billingPrice,
                bookingId
            },
            {
                new: true,
                upsert: true
            }
        );

        if (!document) {
            return res.status(500).json({ message: "Internal server error" });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="final_report.pdf"');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);

    } catch (error) {
        // console.log(error)
    }

}

const getAllInvoices = async (req, res) => {
    try {
        let userId;
        if (req.user.role === 'staff') {
            userId = req.user.parentUser
        } else {
            userId = req.user._id
        }

        let query = {
            tenantId: req.user.tenantId._id,
            createdBy: userId
        };

        // Optional start and end date filtering
        const { start, end } = req.query;

        if (start || end) {
            query.createdAt = {};
            if (start) {
                query.createdAt.$gte = new Date(start);
            }
            if (end) {
                // To include the entire end day, set time to end of the day
                const endDate = new Date(end);
                endDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = endDate;
            }
        }

        const invoicesList = await invoices.find(query).sort({ createdAt: -1 });

        if (invoicesList) {
            for (const invoice of invoicesList) {
                const finalinvoicelist = await invoices.findOne({
                    bookingId: invoice.bookingId
                }).sort({ createdAt: -1 });
            }
        }
        res.status(200).json({
            success: true,
            total: invoicesList.length,
            data: invoicesList
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const certificatepdfgenerator = async (req, res) => {
    let { pdfHtml, pdfcss, userId } = req.body;

    // const getdoc = await certificates.findOne({ userId })

    // if (getdoc) {
    //     pdfHtml = getdoc.pdfHtml;
    //     pdfcss = getdoc.pdfcss;
    // }

    try {
        const pdfBuffer = await withQueuedPdfPage(`certificate-pdf:${userId || 'unknown'}`, async (page) => {
            const contentwithhtmlcss = `
        <html>
        <head>
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
        *, *::before, *::after, html, body, table, tr, th, td, div, span, input, button, textarea, select, p, h1, h2, h3, h4, h5, h6 {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
        }
        ${pdfcss}
        .certificatedImgdiv {
        display: flex;
        }
        </style>
        </head>
        <body>
        ${pdfHtml}
        </body>
        </html>`;

            await page.setContent(contentwithhtmlcss, { waitUntil: 'domcontentloaded', timeout: pdfContentLoadTimeout });
            await waitForPdfDocumentReady(page);

            const renderStart = Date.now();
            const renderedPdf = await renderPdfWithFallback(page, {
                format: 'A4',
                printBackground: true,
                landscape: true,
                margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' }
            });
            updatePdfMetrics({ lastRenderMs: Date.now() - renderStart, lastPdfSizeBytes: renderedPdf.length });
            return renderedPdf;
        });

        // if (!getdoc) {
        //     const document = await certificates.create({
        //         pdfcss: pdfcss,
        //         pdfHtml: pdfHtml,
        //         userId: userId
        //     })
        // }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="final_report.pdf"');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);

    } catch (error) {
        // console.log(error)
    }

}

export {
    pdfgeneratorcontroller2,
    getpdfcontroller,
    savingPdfDatacontroller,
    getCustomizationByReportId,
    invoicepdfgenerator,
    certificatepdfgenerator,
    getAllInvoices,
    getpdfcontrolleruser,
    mergePdfsController

};
