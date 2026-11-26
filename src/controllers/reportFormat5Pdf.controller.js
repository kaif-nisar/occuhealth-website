/**
 * ============================================================================
 * REPORT FORMAT 5 — DEDICATED PDF GENERATOR CONTROLLER (v3 REFINED)
 * ============================================================================
 * File: src/controllers/reportFormat5Pdf.controller.js
 *
 * Key Architectural Upgrades:
 * - Soft, refined slate hairline borders (no heavy thick stripes)
 * - Ultra-compact, uniform Row Spacing (`Spacing = 1` -> `0.5px` padding)
 * - Both Department (`HAEMATOLOGY`) and Profile (`COMPLETE BLOOD COUNT`) banners
 *   rendered ABOVE tables (never inside tbody)
 * - Horizontally centered `Observed Result` ([22px | 54px+ center | 22px H/L rail])
 *   and horizontally centered `Biological Ref. Interval` & `Unit` columns
 * - Right-column compact timestamps + always-visible Investigations in Header
 * - Multi-Specimen Per-Page PDF rendering: when categories span multiple specimen
 *   barcodes (e.g., EDTA CBC vs Serum LFT), each segment renders with its own
 *   repeating specimen barcode header cleanly merged + continuous Page X of Y!
 * ============================================================================
 */

import * as cheerio from "cheerio";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const DEFAULT_BASE_SIDE_PX = 28;
const CM_TO_PX = 37.7952755906;

const escapeHtml = (value = "") =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const formatSignatureCredentialHtml = (rawText = "") => {
    const cleaned = String(rawText ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?(?:p|div|span|strong|b|em|i)[^>]*>/gi, "\n")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (!cleaned.length) {
        return "";
    }

    const [primaryLine, ...subLines] = cleaned;
    const primaryHtml = `<span class="oh5-sign-name">${escapeHtml(primaryLine)}</span>`;
    const subHtml = subLines.length
        ? `<span class="oh5-sign-role">${subLines.map(escapeHtml).join("<br>")}</span>`
        : "";

    return `${primaryHtml}${subHtml}`;
};

/**
 * Synchronizes signatory visibility, Base64 signature images, credential text,
 * and compact vertical QR card inside the PDF footer frame.
 */
const prepareFormat5FooterHtml = ({
    rawFooterHtml = "",
    showlab = false,
    showdoctorfirst = true,
    showdoctorsecond = true,
    fileInputLab = "",
    fileInputDoctorleft = "",
    fileInputDoctorright = "",
    fileInputLabtext = "",
    fileInputDoctorlefttext = "",
    fileInputDoctorrighttext = "",
    parseBooleanSetting,
}) => {
    const isLabVisible = parseBooleanSetting(showlab, false);
    const isDoc1Visible = parseBooleanSetting(showdoctorfirst, true);
    const isDoc2Visible = parseBooleanSetting(showdoctorsecond, true);

    const hasFooterMarkup = String(rawFooterHtml || "").trim().length > 0;
    const $ = cheerio.load(
        hasFooterMarkup
            ? rawFooterHtml
            : `<div class="oh5-footer-wrap">
                    <div class="oh5-footer-top-row">
                        <div class="oh5-qr-block" id="qrBlock"></div>
                        <div class="signatures oh5-signatures">
                            <div class="oh5-sign-slot" id="labInchargeSign"></div>
                            <div class="oh5-sign-slot" id="firstDoctorSign"></div>
                            <div class="oh5-sign-slot" id="secondDoctorSign"></div>
                        </div>
                    </div>
               </div>`,
        null,
        false
    );

    const syncSlot = ({ selectors, visible, imgUrl, credentialText, altText }) => {
        let $slot = null;
        for (const selector of selectors) {
            const candidate = $(selector).first();
            if (candidate.length) {
                $slot = candidate;
                break;
            }
        }

        if (!$slot || !$slot.length) return;

        if (!visible) {
            $slot.attr("style", "display: none !important;");
            $slot.addClass("oh5-sign-hidden");
            return;
        }

        $slot.removeClass("oh5-sign-hidden");
        $slot.attr("style", "display: flex;");

        const existingImgSrc = $slot.find("img").first().attr("src") || "";
        const resolvedImgSrc = String(imgUrl || existingImgSrc || "").trim();

        const existingCredHtml = $slot.find(".oh5-sign-cred, p").first().text()?.trim() || "";
        const resolvedCredText = String(credentialText || existingCredHtml || "").trim();

        const imgHtml = resolvedImgSrc
            ? `<div class="oh5-sign-img-wrap"><img src="${escapeHtml(resolvedImgSrc)}" alt="${escapeHtml(altText)}" class="oh5-sign-img" /></div>`
            : `<div class="oh5-sign-img-wrap oh5-sign-img-empty"></div>`;

        const credInner = formatSignatureCredentialHtml(resolvedCredText);
        const credHtml = credInner ? `<div class="oh5-sign-cred">${credInner}</div>` : `<div class="oh5-sign-cred"></div>`;

        $slot.html(`${imgHtml}<div class="oh5-sign-rule"></div>${credHtml}`);
    };

    syncSlot({
        selectors: ["#labInchargeSign", ".lab-incharge-sign", ".oh5-sign-lab"],
        visible: isLabVisible,
        imgUrl: fileInputLab,
        credentialText: fileInputLabtext,
        altText: "Lab In-Charge Signature",
    });

    syncSlot({
        selectors: ["#firstDoctorSign", ".first-doctor-sign", ".oh5-sign-doc1"],
        visible: isDoc1Visible,
        imgUrl: fileInputDoctorleft,
        credentialText: fileInputDoctorlefttext,
        altText: "Authorized Pathologist Signature",
    });

    syncSlot({
        selectors: ["#secondDoctorSign", ".second-doctor-sign", ".oh5-sign-doc2"],
        visible: isDoc2Visible,
        imgUrl: fileInputDoctorright,
        credentialText: fileInputDoctorrighttext,
        altText: "Second Signatory Signature",
    });

    const $qrBlock = $("#qrBlock, .oh5-qr-block").first();
    const $qrImg = $("#qrimg, img.oh5-qr-img").first();
    if ($qrImg.length && $qrImg.attr("src")) {
        $qrImg.addClass("oh5-qr-img");
        if ($qrBlock.length) {
            $qrBlock.html(`
                ${$qrImg.toString()}
                <div class="oh5-qr-caption"><span class="oh5-qr-title">Scan to Verify</span></div>
            `);
        }
    } else if ($qrBlock.length) {
        $qrBlock.attr("style", "display: none !important;");
    }

    $(".no-print").remove();

    return $.html();
};

/**
 * Cleans header markup AND swaps in an active group's specimen barcode when
 * rendering multi-specimen pages. Note: per user instruction, Investigations inside
 * `.oh5-header-invest` always stays visible whenever present.
 */
const prepareFormat5HeaderHtml = (rawHeaderHtml = "", options = {}) => {
    const cleanedRaw = String(rawHeaderHtml || "").trim();
    if (!cleanedRaw) return "";

    const { specimenBarcode = "", specimenType = "", specimenBarcodeImg = "" } = options;
    const $ = cheerio.load(cleanedRaw, null, false);
    $(".no-print, .edit-icon, .oh5-edit-hint").remove();
    $("[contenteditable]").removeAttr("contenteditable");

    if (specimenBarcode) {
        const $label = $("#oh5HeaderBarcodeLabel, [data-field='specimenBarcode']").first();
        if ($label.length) $label.text(specimenBarcode);

        const $specCell = $("#oh5HeaderSpecimenVal").first();
        if ($specCell.length) {
            const specDisplay = specimenType
                ? `${specimenType} (${specimenBarcode})`
                : `Barcode: ${specimenBarcode}`;
            $specCell.text(specDisplay);
        }
    }

    if (specimenBarcodeImg) {
        const $img = $("#barcodeImage").first();
        if ($img.length) {
            $img.attr("src", specimenBarcodeImg);
        }
    }

    return $.html();
};

/**
 * Cleans interactive UI controls from report body HTML and respects structural
 * Print Setting visibility switches (`showCategory`, `showTestHeading`, `HighLow`).
 */
const prepareFormat5BodyHtml = ({
    rawBodyHtml = "",
    showInvest = true,
    showCategory = true,
    showTestHeading = true,
    HighLow = false,
    layerone = false,
    parseBooleanSetting,
}) => {
    const $ = cheerio.load(String(rawBodyHtml || ""), null, false);

    $(".no-print, .oh5-edit-hint, .edit-badge, .skeleton-box, colgroup").remove();
    $("[contenteditable]").removeAttr("contenteditable");
    $(".cell-edit").each((_, el) => {
        $(el).removeAttr("tabindex title data-placeholder");
    });

    // Remove deleted rows; strip legacy empty delete-handle `td.wrong` cells without dropping notes
    $("tr.deletion, .deletion").each((_, el) => {
        const $el = $(el);
        if ($el.is("tr")) $el.remove();
        else {
            const parentRow = $el.closest("tr");
            parentRow.length ? parentRow.remove() : $el.remove();
        }
    });
    $("td.wrong").each((_, el) => {
        const $td = $(el);
        const $tr = $td.closest("tr");
        if ($td.text().trim() === "" && $tr.find("td").length > 1) {
            $td.remove();
        }
    });

    if (!parseBooleanSetting(showCategory, true)) {
        $(".section-heading-main, .oh5-category-banner, .headings").remove();
    }

    if (!parseBooleanSetting(showTestHeading, true)) {
        $(".section-heading-sub, .oh5-profile-banner, .oh5-profile-title-row").remove();
    }

    if (!parseBooleanSetting(HighLow, false)) {
        $(".HL, .oh5-flag-badge").remove();
    } else {
        $(".HL").each((_, el) => {
            const $hl = $(el);
            if (!$hl.find(".oh5-flag-badge").length) {
                const txt = $hl.text().trim();
                if (txt) $hl.html(`<span class="oh5-flag-badge">${escapeHtml(txt)}</span>`);
                else $hl.remove();
            }
        });
    }

    $(".interpretation, .oh5-interpretation-card, .moreDetails, .oh5-remarks-card").each((_, el) => {
        const $card = $(el);
        const textLen = $card.text().replace(/\u00a0/g, " ").trim().length;
        const hasMedia = $card.find("img, table, ul, ol").length > 0;
        if (textLen === 0 && !hasMedia) $card.remove();
    });

    const $firstBreak = $(".page-break, .oh5-page-break").first();
    if ($firstBreak.length) {
        const hasPrecedingContent = $firstBreak.prevAll().toArray().some((node) => {
            const $node = $(node);
            return $node.text().trim().length > 0 || $node.find("table, tr, img").length > 0;
        });
        if (!hasPrecedingContent) $firstBreak.remove();
    }

    return $.html();
};

/**
 * Splits body sections cleanly by consecutive specimen barcode so multi-specimen
 * bookings produce per-page accurate specimen barcode headers cleanly!
 */
const splitBodyBySpecimenGroups = (cleanedBodyHtml = "") => {
    const $ = cheerio.load(cleanedBodyHtml, null, false);
    const topNodes = $.root().children().toArray();
    const groups = [];
    let currentGroup = null;

    const finishGroup = (grp) => {
        if (!grp) return;
        const $wrap = cheerio.load("<div></div>", null, false);
        const $container = $wrap("div");
        grp.nodes.forEach((n) => $container.append($(n).clone()));
        // Remove leading page-break on the first element of each standalone PDF pass
        $container.children().first().removeClass("page-break oh5-page-break-before");
        groups.push({
            barcode: grp.barcode,
            sampleType: grp.sampleType,
            barcodeImg: grp.barcodeImg,
            html: $container.html() || "",
        });
    };

    topNodes.forEach((node) => {
        const $node = $(node);
        const isSection = $node.hasClass("section") || $node.hasClass("oh5-category-section");
        if (isSection) {
            const bCode = String($node.attr("data-specimen-barcode") || "").trim();
            const bType = String($node.attr("data-specimen-type") || "").trim();
            const bImg = String($node.attr("data-specimen-barcode-img") || "").trim();

            if (!currentGroup) {
                currentGroup = { barcode: bCode, sampleType: bType, barcodeImg: bImg, nodes: [node] };
            } else if (bCode && currentGroup.barcode && bCode !== currentGroup.barcode) {
                finishGroup(currentGroup);
                currentGroup = { barcode: bCode, sampleType: bType, barcodeImg: bImg, nodes: [node] };
            } else {
                if (!currentGroup.barcode && bCode) {
                    currentGroup.barcode = bCode;
                    currentGroup.sampleType = bType;
                    currentGroup.barcodeImg = bImg;
                }
                currentGroup.nodes.push(node);
            }
        } else {
            if (!currentGroup) {
                currentGroup = { barcode: "", sampleType: "", barcodeImg: "", nodes: [node] };
            } else {
                currentGroup.nodes.push(node);
            }
        }
    });

    finishGroup(currentGroup);

    if (!groups.length) {
        return [{ barcode: "", sampleType: "", barcodeImg: "", html: cleanedBodyHtml }];
    }
    return groups;
};

const buildFormat5HeaderTemplateCss = ({
    headermarginPx,
    horizontalLeftPx,
    horizontalRightPx,
    baseFontSizePx,
}) => `
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    html, body {
        width: 100%;
        font-family: 'Inter', 'Segoe UI', Arial, Helvetica, sans-serif;
        color: #0f172a;
        font-size: ${Math.max(9, baseFontSizePx - 1)}px;
        line-height: 1.25;
        background: transparent;
    }
    .oh5-header-shell {
        width: 100%;
        padding: ${headermarginPx}px ${horizontalRightPx}px 0 ${horizontalLeftPx}px;
    }
    .oh5-header-card {
        width: 100%;
        border: 1px solid #d5dde7;
        border-top: 2px solid #2b4c7e;
        border-radius: 4px;
        background-color: #f9fbfd;
        padding: 6px 10px;
    }
    .oh5-header-top-band {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding-bottom: 4.5px;
        margin-bottom: 4.5px;
        border-bottom: 1px solid #e6ecf2;
    }
    .oh5-patient-identity {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
        min-width: 0;
    }
    .oh5-patient-name {
        font-size: ${Math.min(14, baseFontSizePx + 2)}px;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: 0.01em;
        text-transform: uppercase;
    }
    .oh5-age-gender {
        font-size: ${Math.max(8.8, baseFontSizePx - 1.2)}px;
        font-weight: 600;
        color: #2b4c7e;
        background: #e8eef5;
        padding: 1px 7px;
        border-radius: 999px;
        white-space: nowrap;
    }
    .oh5-uhid-pill {
        font-size: ${Math.max(8.5, baseFontSizePx - 1.5)}px;
        font-weight: 600;
        color: #475569;
        background: #ffffff;
        border: 1px solid #d5dde7;
        padding: 1px 6px;
        border-radius: 3px;
        white-space: nowrap;
    }
    .oh5-barcode-box {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
    }
    .oh5-barcode-img-slot img,
    #barcodeImage {
        max-height: 26px;
        max-width: 155px;
        width: auto;
        height: auto;
        display: block;
    }
    .oh5-accession-badge {
        text-align: right;
        line-height: 1.15;
    }
    .oh5-accession-label {
        display: block;
        font-size: 7.2px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
        font-weight: 600;
    }
    .oh5-accession-id {
        display: block;
        font-size: ${Math.max(9.8, baseFontSizePx - 0.5)}px;
        font-weight: 700;
        color: #1e3a5f;
        font-variant-numeric: tabular-nums;
    }
    .oh5-header-grid {
        display: grid;
        grid-template-columns: 0.96fr 1.04fr;
        gap: 0 12px;
        align-items: stretch;
    }
    .oh5-patient-col {
        padding-right: 10px;
        border-right: 1px solid #e6ecf2;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
    }
    .oh5-specimen-col {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        gap: 3px;
    }
    .oh5-meta-table {
        width: 100%;
        border-collapse: collapse;
    }
    .oh5-meta-table td {
        padding: 1px 2px;
        vertical-align: top;
        font-size: ${Math.max(8.8, baseFontSizePx - 1.3)}px;
        line-height: 1.24;
    }
    .oh5-meta-label {
        width: 72px;
        font-weight: 600;
        color: #475569;
        white-space: nowrap;
    }
    .oh5-meta-sep {
        width: 7px;
        color: #64748b;
        text-align: center;
    }
    .oh5-meta-val {
        color: #0f172a;
        font-weight: 500;
        word-break: break-word;
    }
    .oh5-ts-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2px 10px;
        padding-bottom: 3px;
        border-bottom: 1px dashed #d5dde7;
    }
    .oh5-ts-item {
        font-size: ${Math.max(8.5, baseFontSizePx - 1.7)}px;
        line-height: 1.22;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .oh5-ts-lbl {
        font-weight: 600;
        color: #475569;
        margin-right: 3px;
    }
    /* Always show Investigations cleanly in Right Column space (or full-width bar when long) */
    .oh5-header-invest {
        display: flex !important;
        align-items: baseline;
        gap: 5px;
        font-size: ${Math.max(8.6, baseFontSizePx - 1.5)}px;
        line-height: 1.25;
        padding-top: 1px;
        flex-wrap: wrap;
    }
    .oh5-header-invest--full {
        margin-top: 4.5px;
        padding-top: 4px;
        border-top: 1px dashed #d5dde7;
        width: 100%;
    }
    .oh5-invest-label {
        font-weight: 700;
        color: #0f766e;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        white-space: nowrap;
        flex-shrink: 0;
    }
    .oh5-invest-value {
        color: #0f172a;
        font-weight: 600;
        word-break: break-word;
        overflow-wrap: anywhere;
        flex: 1 1 auto;
    }

    /* Compatibility fallback for buildHeaderFromReport */
    .report-details {
        width: 100%;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        border: 1px solid #d5dde7;
        border-top: 2px solid #2b4c7e;
        border-radius: 4px;
        background: #f9fbfd;
        padding: 7px 10px;
        font-size: ${Math.max(8.8, baseFontSizePx - 1.2)}px;
    }
    .report-details p { margin: 1px 0; color: #0f172a; }
    .report-details-innerDiv1 { flex: 1; padding-right: 10px; border-right: 1px solid #e6ecf2; }
    .report-details-innerDiv2 { flex: 1; }
`;

const buildFormat5FooterTemplateCss = ({
    footermarginPx,
    horizontalLeftPx,
    horizontalRightPx,
    baseFontSizePx,
}) => `
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    html, body {
        width: 100%;
        font-family: 'Inter', 'Segoe UI', Arial, Helvetica, sans-serif;
        color: #0f172a;
        font-size: 9px;
        background: transparent;
    }
    .oh5-footer-shell {
        width: 100%;
        padding: 4px ${horizontalRightPx}px ${footermarginPx}px ${horizontalLeftPx}px;
    }
    .oh5-footer-wrap {
        width: 100%;
        border-top: 1px solid #d5dde7;
        padding-top: 5px;
    }
    .oh5-footer-top-row {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
    }
    .oh5-qr-block {
        width: 78px;
        max-width: 82px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 2px;
        padding: 3px 4px;
        border: 1px solid #e6ecf2;
        border-radius: 4px;
        background: #f9fbfd;
        flex-shrink: 0;
    }
    .oh5-qr-block img,
    #qrimg {
        width: 44px;
        height: 44px;
        display: block;
        object-fit: contain;
        background: #ffffff;
    }
    .oh5-qr-caption { width: 100%; line-height: 1.15; }
    .oh5-qr-title {
        display: block;
        font-size: 6.8px;
        font-weight: 700;
        color: #1e3a5f;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        white-space: nowrap;
    }
    .signatures,
    .oh5-signatures {
        flex: 1;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        gap: 14px;
        min-height: 56px;
    }
    .oh5-sign-slot,
    .lab-incharge-sign,
    .first-doctor-sign,
    .second-doctor-sign {
        flex: 1;
        max-width: 190px;
        min-width: 105px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }
    .oh5-sign-img-wrap {
        height: 32px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        margin-bottom: 2px;
    }
    .oh5-sign-img {
        max-height: 31px;
        max-width: 120px;
        width: auto;
        height: auto;
        object-fit: contain;
        display: block;
    }
    .oh5-sign-rule {
        width: 84%;
        height: 1px;
        background-color: #94a3b8;
        margin-bottom: 3px;
    }
    .oh5-sign-cred { line-height: 1.22; }
    .oh5-sign-name {
        display: block;
        font-size: ${Math.max(8.5, Math.min(10.5, baseFontSizePx - 1.3))}px;
        font-weight: 700;
        color: #0f172a;
    }
    .oh5-sign-role {
        display: block;
        font-size: 7.8px;
        color: #475569;
        font-weight: 500;
    }
    .oh5-footer-bottom-meta {
        margin-top: 4px;
        padding-top: 3px;
        border-top: 1px solid #e6ecf2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 7.8px;
        color: #64748b;
    }
    .oh5-page-counter {
        font-weight: 600;
        color: #334155;
        font-variant-numeric: tabular-nums;
    }
`;

const buildFormat5BodyCss = ({
    horizontalLeftPx,
    horizontalRightPx,
    baseFontSizePx,
    rowSpacingPx,
    HLinred,
    BoldRow,
    showCategoryResolved,
    showTestHeadingResolved,
    HighLowResolved,
}) => {
    const abnormalColor = HLinred ? "#b91c1c" : "#0f172a";
    const abnormalBadgeBg = HLinred ? "#fef2f2" : "#f1f5f9";
    const abnormalBadgeBorder = HLinred ? "#fca5a5" : "#cbd5e1";
    const abnormalRowWeight = BoldRow ? "700" : "inherit";
    const subTextSize = Math.max(8, baseFontSizePx - 2).toFixed(1);
    const headerLabelSize = Math.max(8.5, baseFontSizePx - 1.5).toFixed(1);
    const categoryTitleSize = (baseFontSizePx + 1).toFixed(1);
    const profileHeadingSize = baseFontSizePx.toFixed(1);

    return `
        @page {
            size: A4;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            background: transparent;
            color: #0f172a;
            font-family: 'Inter', 'Segoe UI', Arial, Helvetica, sans-serif;
            font-size: ${baseFontSizePx}px;
            line-height: 1.18;
            font-variant-numeric: tabular-nums;
        }
        .oh5-doc-body {
            width: 100%;
            padding-left: ${horizontalLeftPx}px;
            padding-right: ${horizontalRightPx}px;
        }
        .oh5-category-section {
            margin-bottom: 7px;
        }
        /* Category & Profile Headings sit ABOVE tables with refined soft borders */
        .section-heading-main,
        .oh5-category-banner {
            display: ${showCategoryResolved ? "flex" : "none"} !important;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: #f3f6fa;
            border-top: 1px solid #cbd5e1;
            border-bottom: 1px solid #cbd5e1;
            padding: 3.5px 10px;
            margin: 5px 0 4px 0;
            font-size: ${categoryTitleSize}px;
            font-weight: 700;
            color: #1e3a5f;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            break-after: avoid;
            page-break-after: avoid;
        }
        .oh5-category-section:first-child .section-heading-main,
        .oh5-category-section:first-child .oh5-category-banner {
            margin-top: 0;
        }
        .oh5-profile-banner {
            display: ${showTestHeadingResolved ? "flex" : "none"} !important;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: #fafcfe;
            border-top: 1px solid #e6ecf2;
            border-bottom: 1px solid #d5dde7;
            color: #0f766e;
            font-size: ${profileHeadingSize}px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            padding: 3px 10px;
            margin: 4px 0 0 0;
            break-after: avoid;
            page-break-after: avoid;
        }
        /* Results Table */
        .test-table,
        .oh5-results-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            table-layout: fixed;
            margin: 0 0 5px 0;
            background: transparent;
        }
        .test-table thead,
        .oh5-results-table thead {
            display: table-header-group;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .test-table thead th:nth-child(1),
        .oh5-results-table thead th:nth-child(1) { width: 40%; text-align: left; }
        .test-table thead th:nth-child(2),
        .oh5-results-table thead th:nth-child(2) { width: 21%; text-align: center; }
        .test-table thead th:nth-child(3),
        .oh5-results-table thead th:nth-child(3) { width: 14%; text-align: center; }
        .test-table thead th:nth-child(4),
        .oh5-results-table thead th:nth-child(4) { width: 25%; text-align: center; }
        .test-table thead th,
        .oh5-results-table thead th {
            background: #f9fbfd;
            border-top: 1px solid #d5dde7;
            border-bottom: 1px solid #94a3b8;
            color: #1e3a5f;
            font-size: ${headerLabelSize}px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 4px 8px;
            vertical-align: middle;
        }
        .test-table tbody tr,
        .oh5-results-table tbody tr {
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .test-table tbody td,
        .oh5-results-table tbody td {
            padding: ${rowSpacingPx}px 8px;
            font-size: ${baseFontSizePx}px;
            line-height: 1.18;
            vertical-align: middle;
            color: #0f172a;
            border-bottom: 1px solid #eef2f6;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        /* Legacy fallback support if profile header is a table row */
        .section-heading-sub:is(tr),
        .oh5-profile-title-row {
            display: ${showTestHeadingResolved ? "table-row" : "none"} !important;
            background-color: #fafcfe;
            break-after: avoid;
            page-break-after: avoid;
        }
        .section-heading-sub:is(tr) td,
        .oh5-profile-title-row td {
            text-align: center !important;
            font-size: ${profileHeadingSize}px;
            font-weight: 700;
            color: #0f766e;
            padding: 3px 10px !important;
            text-transform: uppercase;
            border-top: 1px solid #e6ecf2;
            border-bottom: 1px solid #d5dde7;
        }
        .parameter-row td:first-child,
        .oh5-param-row td:first-child {
            padding-left: 16px;
        }
        .oh5-param-indent {
            display: inline-block;
            border-left: 1.5px solid #d5dde7;
            padding-left: 7px;
        }
        .oh5-test-title,
        .test-name {
            font-weight: 600;
            color: #0f172a;
            font-size: ${baseFontSizePx}px;
        }
        .parameter-row .oh5-test-title,
        .oh5-param-row .oh5-test-title {
            font-weight: 500;
            color: #1e293b;
        }
        .methods,
        .oh5-method-note {
            display: block;
            margin-top: 0.5px;
            font-size: ${subTextSize}px;
            color: #64748b;
            font-style: italic;
            font-weight: 400;
            line-height: 1.12;
        }
        .oh5-col-result-cell,
        .test-table tbody td:nth-child(2) {
            text-align: center !important;
        }
        .oh5-unit-cell,
        .test-table tbody td:nth-child(3) {
            text-align: center !important;
            font-size: ${Math.max(8.5, baseFontSizePx - 0.4)}px;
            color: #475569;
        }
        .oh5-ref-block,
        .test-table tbody td:nth-child(4) {
            text-align: center !important;
            font-size: ${Math.max(8.5, baseFontSizePx - 0.5)}px;
            color: #334155;
        }
        .oh5-ref-text {
            display: block;
            width: 100%;
            text-align: center !important;
            white-space: pre-line;
            line-height: 1.2;
        }
        /* Symmetric 3-track grid -> centers Observed Result & holds H/L on fixed rail */
        .oh5-result-wrap {
            display: inline-grid;
            grid-template-columns: 22px minmax(54px, auto) 22px;
            align-items: center;
            justify-content: center;
            column-gap: 4px;
            margin: 0 auto;
            max-width: 100%;
        }
        .oh5-result-spacer {
            width: 22px;
            display: inline-block;
        }
        .oh5-result-value {
            font-weight: 600;
            color: #0f172a;
            text-align: center !important;
            display: block;
            font-variant-numeric: tabular-nums;
            word-break: break-word;
        }
        .oh5-flag-slot {
            width: 22px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .oh5-row--abnormal,
        .BoldRow,
        tr.BoldRow td {
            font-weight: ${abnormalRowWeight};
        }
        .oh5-row--abnormal .oh5-result-value,
        .high-low,
        .oh5-result-value.is-abnormal {
            color: ${abnormalColor} !important;
            font-weight: 700;
        }
        .HL {
            display: ${HighLowResolved ? "inline-flex" : "none"} !important;
            align-items: center;
            justify-content: center;
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        .oh5-flag-badge {
            display: ${HighLowResolved ? "inline-flex" : "none"} !important;
            align-items: center;
            justify-content: center;
            min-width: 17px;
            height: 14px;
            padding: 0 4px;
            border-radius: 3px;
            font-size: ${Math.max(7.5, baseFontSizePx - 2.3)}px;
            font-weight: 700;
            letter-spacing: 0.02em;
            background: ${abnormalBadgeBg};
            color: ${abnormalColor};
            border: 1px solid ${abnormalBadgeBorder};
            line-height: 1;
        }
        .documented-content,
        .oh5-documented-card {
            margin: 4px 0 7px 0;
            padding: 6px 10px;
            border: 1px solid #e6ecf2;
            border-radius: 4px;
            background: #ffffff;
            font-size: ${baseFontSizePx}px;
            line-height: 1.38;
            color: #0f172a;
        }
        .documented-content p,
        .oh5-documented-card p { margin: 0 0 4px 0; }
        .documented-content table,
        .oh5-documented-card table {
            width: 100%;
            border-collapse: collapse;
            margin: 4px 0;
        }
        .documented-content td,
        .documented-content th,
        .oh5-documented-card td,
        .oh5-documented-card th {
            border: 1px solid #d5dde7;
            padding: 3px 6px;
            font-size: ${Math.max(9, baseFontSizePx - 0.5)}px;
        }
        .documented-content ul,
        .documented-content ol,
        .oh5-documented-card ul,
        .oh5-documented-card ol {
            padding-left: 18px;
            margin: 3px 0 5px 0;
        }
        .interpretation,
        .oh5-interpretation-card,
        .moreDetails,
        .oh5-remarks-card {
            margin: 4px 0 7px 0;
            padding: 5px 9px;
            background: #f9fbfd;
            border: 1px solid #e6ecf2;
            border-left: 2.5px solid #0f766e;
            border-radius: 4px;
            font-size: ${Math.max(8.8, baseFontSizePx - 0.9)}px;
            line-height: 1.34;
            color: #334155;
            text-align: left;
            break-inside: avoid-page;
        }
        .oh5-interpretation-title,
        .oh5-remarks-title {
            display: block;
            font-size: ${Math.max(8.2, baseFontSizePx - 1.5)}px;
            font-weight: 700;
            color: #0f766e;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 2px;
        }
        .oh5-end-of-report {
            margin: 8px 0 4px 0;
            text-align: center;
            font-size: ${Math.max(8.2, baseFontSizePx - 1.5)}px;
            font-weight: 600;
            letter-spacing: 0.14em;
            color: #64748b;
            text-transform: uppercase;
        }
        .oh5-end-of-report::before,
        .oh5-end-of-report::after {
            content: "";
            display: inline-block;
            width: 50px;
            height: 1px;
            background: #d5dde7;
            vertical-align: middle;
            margin: 0 10px;
        }
        .page-break,
        .oh5-page-break {
            page-break-before: always;
            break-before: page;
            height: 0;
            margin: 0;
            padding: 0;
        }
        .cell-edit {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
        }
    `;
};

/**
 * Stamps continuous `Page X of Y` cleanly when multi-specimen PDF segments
 * have been merged together into one combined document.
 */
const stampMergedPageNumbers = async (mergedPdfBytes, footerMarginPx, horizontalLeftPx, horizontalRightPx) => {
    const pdfDoc = await PDFDocument.load(mergedPdfBytes);
    const pages = pdfDoc.getPages();
    const total = pages.length;
    if (total === 0) return Buffer.from(mergedPdfBytes);

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 7.8;
    const xLeftPts = horizontalLeftPx * 0.75;
    const xRightPts = horizontalRightPx * 0.75;
    const yPts = Math.max(12, footerMarginPx * 0.75 + 6);

    pages.forEach((page, idx) => {
        const { width } = page.getSize();
        const rightLabel = `Page ${idx + 1} of ${total}`;
        const textWidth = fontBold.widthOfTextAtSize(rightLabel, fontSize);

        // Draw both footer left label & page counter on the exact same baseline
        page.drawText("Report Format: Format 5 (Clinical Standard)", {
            x: xLeftPts,
            y: yPts,
            size: fontSize,
            font: fontRegular,
            color: rgb(0.392, 0.455, 0.545),
        });
        page.drawText(rightLabel, {
            x: Math.max(120, width - xRightPts - textWidth),
            y: yPts,
            size: fontSize,
            font: fontBold,
            color: rgb(0.2, 0.255, 0.333),
        });
    });

    return Buffer.from(await pdfDoc.save());
};

/**
 * Core Format 5 PDF generator returning an A4 Buffer.
 */
const renderReportFormat5Buffer = async (params, deps) => {
    const {
        layerone = false,
        tenantId,
        bookingId,
        reportId,
        BoldRow = false,
        HLinred = false,
        HighLow = false,
        RowSpacing = 1,
        selectedFontSize = 10.5,
        htmlContent = "",
        header = "",
        footer = "",
        backgroundImageUrl = "",
        headermargin = 2.8,
        footermargin = 1.0,
        marginRight = 0,
        marginLeft = 0,
        headerContentGap = 0.7,
        showlab = false,
        showdoctorfirst = true,
        showdoctorsecond = true,
        fileInputLab = "",
        fileInputDoctorleft = "",
        fileInputDoctorright = "",
        fileInputLabtext = "",
        fileInputDoctorlefttext = "",
        fileInputDoctorrighttext = "",
        showCategory = true,
        showTestHeading = true,
        checkBox = false,
        nablLogoUrl = "",
        nablSettings = null,
        res = null,
        user = null,
    } = params;

    const {
        withQueuedPdfPage,
        waitForPdfDocumentReady,
        renderPdfWithFallback,
        inlinePdfHtmlSegments,
        flattenPdfToSecureBuffer,
        addBackgroundToPdf,
        finitePdfNumber,
        parseBooleanSetting,
        enforceSecureReportPdf,
        sanitizeNablSettings,
        resolveNablLogoForReport,
        applyNablLogoToPdf,
        mergePdfWithBookingAttachments,
    } = deps;

    const cmToPx = (cm) => cm * CM_TO_PX;

    const headerMarginCm = finitePdfNumber(headermargin, 2.8, { min: 0, max: 10 });
    const footerMarginCm = finitePdfNumber(footermargin, 1.0, { min: 0, max: 6 });
    const marginLeftCm = finitePdfNumber(marginLeft, 0, { min: 0, max: 4 });
    const marginRightCm = finitePdfNumber(marginRight, 0, { min: 0, max: 4 });
    const headerGapCm = finitePdfNumber(headerContentGap, 0.7, { min: 0.1, max: 10 });

    const headermarginPx = Math.round(cmToPx(headerMarginCm));
    const footermarginPx = Math.round(cmToPx(footerMarginCm));
    const headerContentGapPx = Math.round(cmToPx(headerGapCm));
    const horizontalLeftPx = DEFAULT_BASE_SIDE_PX + Math.round(cmToPx(marginLeftCm));
    const horizontalRightPx = DEFAULT_BASE_SIDE_PX + Math.round(cmToPx(marginRightCm));

    const baseFontSizePx = finitePdfNumber(selectedFontSize, 10.5, { min: 8, max: 18 });
    const rowSpacingUnits = finitePdfNumber(RowSpacing, 1, { min: 0, max: 12 });
    // Ultra-compact at Spacing = 1 -> 0.5px top & bottom, scaling cleanly up to 8.2px at 12
    const rowSpacingPx = rowSpacingUnits <= 0
        ? 0
        : Number((0.5 + (rowSpacingUnits - 1) * 0.7).toFixed(2));

    const isLayerOne = Boolean(layerone === true || layerone === "1layer");
    const showCategoryResolved = parseBooleanSetting(showCategory, true);
    const showTestHeadingResolved = parseBooleanSetting(showTestHeading, true);
    const highLowResolved = parseBooleanSetting(HighLow, false);
    const hlInRedResolved = parseBooleanSetting(HLinred, false);
    const boldRowResolved = parseBooleanSetting(BoldRow, false);

    const cleanedFooterInner = prepareFormat5FooterHtml({
        rawFooterHtml: footer,
        showlab,
        showdoctorfirst,
        showdoctorsecond,
        fileInputLab,
        fileInputDoctorleft,
        fileInputDoctorright,
        fileInputLabtext,
        fileInputDoctorlefttext,
        fileInputDoctorrighttext,
        parseBooleanSetting,
    });
    const cleanedBodyHtml = prepareFormat5BodyHtml({
        rawBodyHtml: htmlContent,
        showInvest: true,
        showCategory: showCategoryResolved,
        showTestHeading: showTestHeadingResolved,
        HighLow: highLowResolved,
        layerone: isLayerOne,
        parseBooleanSetting,
    });

    // Split body cleanly by specimen barcode so each page displays its own specimen barcode
    const specimenGroups = splitBodyBySpecimenGroups(cleanedBodyHtml);
    const isMultiSpecimen = specimenGroups.length > 1;

    const headerTemplateCss = buildFormat5HeaderTemplateCss({
        headermarginPx,
        horizontalLeftPx,
        horizontalRightPx,
        baseFontSizePx,
    });
    const footerTemplateCss = buildFormat5FooterTemplateCss({
        footermarginPx,
        horizontalLeftPx,
        horizontalRightPx,
        baseFontSizePx,
    });
    const bodyCss = buildFormat5BodyCss({
        horizontalLeftPx,
        horizontalRightPx,
        baseFontSizePx,
        rowSpacingPx,
        HLinred: hlInRedResolved,
        BoldRow: boldRowResolved,
        showCategoryResolved,
        showTestHeadingResolved,
        HighLowResolved: highLowResolved,
    });

    const inlinedFooterRes = await inlinePdfHtmlSegments({
        htmlContent: "",
        header: "",
        footer: cleanedFooterInner,
    });

    const footerTemplateHtml = `
        <style>${footerTemplateCss}</style>
        <div class="oh5-footer-shell" id="oh5FooterRoot">
            ${inlinedFooterRes.footer}
            <div class="oh5-footer-bottom-meta">
                ${isMultiSpecimen
                    ? `<span>&nbsp;</span><span class="oh5-page-counter">&nbsp;</span>`
                    : `<span>Report Format: Format 5 (Clinical Standard)</span><span class="oh5-page-counter">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>`}
            </div>
        </div>
    `;

    const rawPdfBuffer = await withQueuedPdfPage("reportFormat5Pdf", async (page) => {
        await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

        const segmentBuffers = [];

        for (const group of specimenGroups) {
            const groupHeaderHtml = prepareFormat5HeaderHtml(header, {
                specimenBarcode: group.barcode,
                specimenType: group.sampleType,
                specimenBarcodeImg: group.barcodeImg,
            });

            const inlinedGroup = await inlinePdfHtmlSegments({
                htmlContent: group.html,
                header: groupHeaderHtml,
                footer: "",
            });

            const headerTemplateHtml = inlinedGroup.header
                ? `<style>${headerTemplateCss}</style><div class="oh5-header-shell" id="oh5HeaderRoot">${inlinedGroup.header}</div>`
                : `<div style="height:1px;"></div>`;

            // Measure exact header/footer heights at A4 width for this specimen header
            const measurementDoc = `
                <!DOCTYPE html>
                <html>
                <head><meta charset="utf-8" /></head>
                <body style="margin:0;padding:0;width:794px;">
                    <div id="measureHeaderWrap" style="width:794px;">${headerTemplateHtml}</div>
                    <div id="measureFooterWrap" style="width:794px;">${footerTemplateHtml}</div>
                </body>
                </html>
            `;
            await page.setContent(measurementDoc, { waitUntil: "domcontentloaded" });
            await waitForPdfDocumentReady(page);

            const measured = await page.evaluate(() => {
                const hEl = document.getElementById("measureHeaderWrap");
                const fEl = document.getElementById("measureFooterWrap");
                return {
                    headerHeight: hEl ? Math.ceil(hEl.getBoundingClientRect().height) : 0,
                    footerHeight: fEl ? Math.ceil(fEl.getBoundingClientRect().height) : 0,
                };
            });

            const safeHeaderHeight = inlinedGroup.header
                ? Math.min(460, Math.max(headermarginPx + 45, measured.headerHeight || headermarginPx + 100))
                : headermarginPx;
            const safeFooterHeight = Math.min(340, Math.max(footermarginPx + 58, measured.footerHeight || footermarginPx + 88));

            const marginTopPx = safeHeaderHeight + headerContentGapPx;
            const marginBottomPx = safeFooterHeight + 10;

            const bodyDoc = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8" />
                    <style>${bodyCss}</style>
                </head>
                <body>
                    <div class="oh5-doc-body">
                        ${inlinedGroup.htmlContent}
                    </div>
                </body>
                </html>
            `;

            await page.setContent(bodyDoc, { waitUntil: "domcontentloaded" });
            await waitForPdfDocumentReady(page);

            const segBuf = await renderPdfWithFallback(
                page,
                {
                    format: "A4",
                    printBackground: true,
                    preferCSSPageSize: false,
                    displayHeaderFooter: true,
                    headerTemplate: headerTemplateHtml,
                    footerTemplate: footerTemplateHtml,
                    margin: {
                        top: `${marginTopPx}px`,
                        bottom: `${marginBottomPx}px`,
                        left: "0px",
                        right: "0px",
                    },
                },
                "reportFormat5"
            );

            segmentBuffers.push(segBuf);
        }

        if (segmentBuffers.length === 1) {
            return segmentBuffers[0];
        }

        const mergedDoc = await PDFDocument.create();
        for (const segBytes of segmentBuffers) {
            const segPdf = await PDFDocument.load(segBytes);
            const copiedPages = await mergedDoc.copyPages(segPdf, segPdf.getPageIndices());
            copiedPages.forEach((p) => mergedDoc.addPage(p));
        }

        const savedMerged = await mergedDoc.save();
        return await stampMergedPageNumbers(savedMerged, footermarginPx, horizontalLeftPx, horizontalRightPx);
    });

    const shouldApplyLetterhead = !Boolean(checkBox) && Boolean(String(backgroundImageUrl || "").trim());
    const pdfWithBackground = shouldApplyLetterhead
        ? (await addBackgroundToPdf(rawPdfBuffer, backgroundImageUrl)) || rawPdfBuffer
        : rawPdfBuffer;

    const nablLogoToApply =
        nablLogoUrl ||
        (await resolveNablLogoForReport({
            tenantId,
            bookingId,
            reportId,
            user: user || res?.req?.user,
        }));
    const pdfWithNabl =
        (await applyNablLogoToPdf(
            pdfWithBackground,
            nablLogoToApply,
            sanitizeNablSettings ? sanitizeNablSettings(nablSettings || {}) : nablSettings
        )) || pdfWithBackground;

    const attachmentAwareBuffer = await mergePdfWithBookingAttachments({
        pdfBuffer: pdfWithNabl,
        tenantId,
        bookingId,
        reportId,
    });

    if (enforceSecureReportPdf) {
        return await flattenPdfToSecureBuffer(attachmentAwareBuffer);
    }

    return attachmentAwareBuffer;
};

const generateReportFormat5Pdf = async (params, deps) => {
    const { bookingId, reportId, res } = params;
    const { reports, buildPdfFilename } = deps;

    try {
        const finalPdfBuffer = await renderReportFormat5Buffer(params, deps);

        const reportDoc = await reports
            .findOne(reportId ? { _id: reportId } : { bookingId })
            .select("patientName bookingId")
            .lean();
        const patientName = reportDoc?.patientName || "";
        const resolvedBookingId = reportDoc?.bookingId || bookingId;
        const pdfFilename = buildPdfFilename(patientName, resolvedBookingId);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${pdfFilename}"; filename*=UTF-8''${encodeURIComponent(pdfFilename)}`
        );
        res.setHeader("Content-Length", finalPdfBuffer.length);
        res.end(finalPdfBuffer);
    } catch (error) {
        console.error("[ReportFormat5 PDF] Error generating PDF:", error);
        if (!res.headersSent) {
            res.status(500).json({
                message: "Error generating Format 5 PDF",
                error: error.message,
            });
        }
    }
};

const generateReportFormat5PdfBuffer = async (params, deps) => {
    return await renderReportFormat5Buffer(params, deps);
};

export {
    generateReportFormat5Pdf,
    generateReportFormat5PdfBuffer,
    prepareFormat5HeaderHtml,
    prepareFormat5BodyHtml,
    prepareFormat5FooterHtml,
    buildFormat5BodyCss,
    splitBodyBySpecimenGroups,
};
