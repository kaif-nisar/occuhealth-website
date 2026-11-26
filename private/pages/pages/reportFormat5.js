/**
 * ============================================================================
 * REPORT FORMAT 5 — EXECUTIVE CLINICAL DIAGNOSTIC VIEWER & ENGINE (v3)
 * ============================================================================
 * File: private/pages/pages/reportFormat5.js
 *
 * Key Architectural Guarantees:
 * 1. Authentic Specimen Barcode Per Report & Per Page:
 *    Resolves each category/section's exact specimen barcode (`sampleDetails`,
 *    `CategoryAndTest[].sampleDetails`, `bookingTableData`, `acceptedbarcode`)
 *    — only falling back to bookingId when no specimen barcode exists.
 *    Each A4 sheet header (and multi-page PDF segment) displays that page's
 *    exact specimen barcode!
 * 2. Both Category & Test/Profile Headings Outside & Above Tables:
 *    Department (`HAEMATOLOGY`) and Test Profile (`COMPLETE BLOOD COUNT`) banners
 *    render cleanly ABOVE each `<table>` (never inside `<tbody>`).
 * 3. Horizontally Centered Results + Biological Ref. Interval + Straight H/L Rail:
 *    Observed Result uses a symmetric 3-track grid (`22px | 54px+ center | 22px`),
 *    keeping numeric results centered under `OBSERVED RESULT` AND keeping `H`/`L`
 *    badges on a 0px-jitter vertical rail with zero double circles.
 * 4. Compact, Even & Customizable Row Gap (Default = 1 -> 0.5px padding):
 *    Respects Print Settings `spacing` (1–12) AND provides a live `#oh5RowGapInput`
 *    slider (`0–12`) right in the viewer bar.
 * 5. Balanced Compact Header With Investigations Always Visible:
 *    Left column holds referral/client/contact/specimen; Right column holds compact
 *    2×2 specimen timestamps + full Investigations summary underneath.
 * 6. Portaled Send Report Modal:
 *    Moves `#popupModal` & `#toastStack` to `document.body` (`z-index: 250000+`)
 *    so navbar and left sidebar never obscure the dialog.
 * ============================================================================
 */

(function (global) {
    'use strict';

    if (typeof global.__oh5Cleanup === 'function') {
        try {
            global.__oh5Cleanup();
        } catch (cleanupErr) {
            console.warn('[Format5] Previous instance cleanup warning:', cleanupErr);
        }
    }

    const BASE_URL = global.BASE_URL || global.location.origin;
    const CM_TO_PX = 37.7952755906;
    const A4_HEIGHT_PX = 1123;
    const DEFAULT_SIDE_PAD_PX = 28;

    const abortController = new AbortController();
    const { signal } = abortController;

    let activeUser = {};
    try {
        activeUser = typeof user !== 'undefined' && user ? user : (global.user || {});
    } catch (_) {
        activeUser = global.user || {};
    }

    const effectiveFormat =
        (activeUser?.role === 'staff'
            ? (activeUser?.createdBy?.pdfFormat || activeUser?.pdfFormat)
            : activeUser?.pdfFormat) || 'reportFormat5';

    const tenantId =
        activeUser?.tenantId?._id ||
        activeUser?.tenantId ||
        activeUser?.createdBy?.tenantId?._id ||
        activeUser?.createdBy?.tenantId ||
        '';

    const isLayerOneTenant = activeUser?.tenantId?.modelType === '1layer';

    const urlParams = new URLSearchParams(global.location.search);
    const urlValue1 = urlParams.get('value1') || localStorage.getItem('myKey') || '';

    const state = {
        value1: urlValue1,
        reportId: '',
        bookingId: '',
        report: null,
        bookingData: null,
        backgroundImageUrl: '',
        doctorsSign: null,
        barcodeMap: new Map(), // specimenBarcode -> Base64 Code-128 PNG
        defaultSpecimen: { barcodeId: '', sampleType: '' },
        qrDataUrl: '',
        qrLinkUrl: '',
        withoutLetterhead: false,
        categoryNodes: [],     // Top-level .oh5-category-section nodes (with data-specimen-*)
        remarksNode: null,
        endNode: null,
        headerElement: null,
        footerElement: null,
        portaledNodes: [],
        settings: {
            headermargin: 2.8,
            footermargin: 1.0,
            marginLeft: 0,
            marginRight: 0,
            headerContentGap: 0.7,
            selectedFontSize: 10.5,
            RowSpacing: 1, // Compact industry default matching Print Settings Spacing = 1
            HighLow: true,
            HLinred: true,
            BoldRow: false,
            showInvest: true,
            showCategory: true,
            showTestHeading: true,
            showlab: false,
            showdoctorfirst: true,
            showdoctorsecond: true,
            fileInputLab: '',
            fileInputDoctorleft: '',
            fileInputDoctorright: '',
            fileInputLabtext: '',
            fileInputDoctorlefttext: '',
            fileInputDoctorrighttext: '',
            nablLogoUrl: '',
            nablSettings: null,
        },
        activeShareChannel: '',
        currentPreviewPdfUrl: '',
        hasSavedInitialSnapshot: false,
        saveTimer: null,
    };

    /* =========================================================================
     * 1. UTILITY HELPERS & SPECIMEN BARCODE MATCHING
     * ========================================================================= */

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseNum(value, fallback, min = -Infinity, max = Infinity) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(max, Math.max(min, parsed));
    }

    function parseBool(value, fallback = false) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const norm = value.trim().toLowerCase();
            if (norm === 'true' || norm === '1' || norm === 'yes') return true;
            if (norm === 'false' || norm === '0' || norm === 'no') return false;
        }
        return fallback;
    }

    function stripHtmlTags(raw) {
        if (!raw) return '';
        const div = document.createElement('div');
        div.innerHTML = String(raw);
        return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeText(value) {
        return stripHtmlTags(String(value ?? ''))
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function sanitizeRichHtml(raw) {
        if (!raw) return '';
        const template = document.createElement('template');
        template.innerHTML = String(raw);
        template.content.querySelectorAll('script, iframe, object, embed, link').forEach((n) => n.remove());
        template.content.querySelectorAll('*').forEach((el) => {
            Array.from(el.attributes).forEach((attr) => {
                const name = attr.name.toLowerCase();
                if (name.startsWith('on') || (name === 'href' && attr.value.trim().toLowerCase().startsWith('javascript:'))) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return template.innerHTML;
    }

    function portalOverlaysToBody() {
        const overlayStyle = document.getElementById('oh5OverlayStyles');
        if (overlayStyle && !document.head.contains(overlayStyle)) {
            const clonedStyle = overlayStyle.cloneNode(true);
            clonedStyle.id = 'oh5OverlayStyles';
            document.head.appendChild(clonedStyle);
            overlayStyle.remove();
            state.portaledNodes.push(clonedStyle);
        }

        ['popupModal', 'toastStack'].forEach((id) => {
            document.querySelectorAll(`body > #${id}`).forEach((n) => {
                const pageRoot = document.getElementById('oh5PageRoot');
                if (!pageRoot || !pageRoot.contains(n)) {
                    n.remove();
                }
            });

            const node = document.getElementById(id);
            if (node && node.parentElement !== document.body) {
                document.body.appendChild(node);
                state.portaledNodes.push(node);
            }
        });
    }

    function toast(message, type = 'info') {
        const stack = document.getElementById('toastStack');
        if (!stack) return;
        const item = document.createElement('div');
        item.className = `oh5-toast is-${type}`;
        item.textContent = message;
        stack.appendChild(item);
        setTimeout(() => {
            item.style.opacity = '0';
            item.style.transition = 'opacity 0.25s ease';
            setTimeout(() => item.remove(), 260);
        }, 3600);
    }

    function setButtonLoading(buttonId, isLoading) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        btn.disabled = isLoading;
        const overlay = btn.closest('.downloadDiv')?.querySelector('.loading-overlay');
        if (overlay) {
            overlay.style.display = isLoading ? 'flex' : 'none';
        }
    }

    async function imageToBase64(url) {
        const safeUrl = String(url || '').trim();
        if (!safeUrl) return '';
        if (safeUrl.startsWith('data:') || safeUrl.startsWith('blob:')) return safeUrl;

        try {
            const response = await fetch(safeUrl, { cache: 'no-store', signal });
            if (!response.ok) return safeUrl;
            const blob = await response.blob();
            return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result || safeUrl);
                reader.onerror = () => resolve(safeUrl);
                reader.readAsDataURL(blob);
            });
        } catch (_) {
            return safeUrl;
        }
    }

    /**
     * Compact clinical date formatter: "25-Nov-26, 09:15 AM"
     */
    function formatClinicalDate(rawDate, rawTime) {
        if (!rawDate) return '';
        let parsed = new Date(rawDate);
        if (Number.isNaN(parsed.getTime()) && typeof rawDate === 'string') {
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) {
                const [p1, p2, p3] = parts.map(Number);
                if (p3 > 1900) parsed = new Date(p3, p2 - 1, p1);
                else if (p1 > 1900) parsed = new Date(p1, p2 - 1, p3);
            }
        }
        if (Number.isNaN(parsed.getTime())) {
            return `${rawDate}${rawTime ? ` ${rawTime}` : ''}`.trim();
        }
        const dateStr = parsed.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: '2-digit',
        });
        if (rawTime && String(rawTime).trim()) {
            return `${dateStr}, ${String(rawTime).trim()}`;
        }
        const hasTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0;
        if (!hasTime) return dateStr;
        const timeStr = parsed.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
        return `${dateStr}, ${timeStr}`;
    }

    function evaluateReferenceFlag(rawValue, rawReference) {
        const valStr = String(rawValue ?? '').trim();
        const refStr = String(rawReference ?? '').trim();

        if (!valStr) {
            return { isAbnormal: false, flag: '', isNumeric: false };
        }

        const numVal = parseFloat(valStr.replace(/,/g, ''));
        const isPureNumeric = !Number.isNaN(numVal) && /^-?\d+(?:\.\d+)?$/.test(valStr.replace(/,/g, ''));

        if (isPureNumeric && refStr) {
            const rangeMatch = refStr.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)/i);
            if (rangeMatch) {
                const low = parseFloat(rangeMatch[1]);
                const high = parseFloat(rangeMatch[2]);
                if (Number.isFinite(low) && Number.isFinite(high)) {
                    if (numVal < low) return { isAbnormal: true, flag: 'L', isNumeric: true };
                    if (numVal > high) return { isAbnormal: true, flag: 'H', isNumeric: true };
                    return { isAbnormal: false, flag: '', isNumeric: true };
                }
            }

            const upperMatch = refStr.match(/^(?:<=|<|up\s*to)\s*(-?\d+(?:\.\d+)?)/i);
            if (upperMatch) {
                const limit = parseFloat(upperMatch[1]);
                if (Number.isFinite(limit) && numVal > limit) {
                    return { isAbnormal: true, flag: 'H', isNumeric: true };
                }
            }

            const lowerMatch = refStr.match(/^(?:>=|>)\s*(-?\d+(?:\.\d+)?)/i);
            if (lowerMatch) {
                const limit = parseFloat(lowerMatch[1]);
                if (Number.isFinite(limit) && numVal < limit) {
                    return { isAbnormal: true, flag: 'L', isNumeric: true };
                }
            }
        }

        const lowerVal = valStr.toLowerCase();
        const lowerRef = refStr.toLowerCase();
        if (
            (lowerVal.includes('positive') && !lowerRef.includes('positive')) ||
            (lowerVal.includes('reactive') && !lowerVal.includes('non-reactive') && !lowerVal.includes('non reactive')) ||
            (lowerVal === 'detected' && lowerRef.includes('not detected'))
        ) {
            return { isAbnormal: true, flag: 'H', isNumeric: false };
        }

        return { isAbnormal: false, flag: '', isNumeric: isPureNumeric };
    }

    /**
     * Collects every specimen entry (`{ barcodeId, sampleType, testNames }`) from
     * `report.sampleDetails`, `CategoryAndTest[].sampleDetails`, `report.bookingTableData`,
     * and `booking.acceptedbarcode` / `booking.tableData`.
     */
    function collectAllSpecimenEntries(report, bookingData) {
        const entries = [];
        const addEntry = (rawBarcode, rawType, rawTestNames = []) => {
            const barcodeId = String(rawBarcode ?? '').trim();
            const sampleType = String(rawType ?? '').trim();
            const testNames = Array.isArray(rawTestNames)
                ? rawTestNames.map(normalizeText).filter(Boolean)
                : String(rawTestNames ?? '')
                      .split(/[,;/|]/)
                      .map(normalizeText)
                      .filter(Boolean);

            if (!barcodeId && !sampleType) return;
            entries.push({ barcodeId, sampleType, testNames });
        };

        if (Array.isArray(report?.CategoryAndTest)) {
            report.CategoryAndTest.forEach((sec) => {
                (sec?.sampleDetails || []).forEach((s) =>
                    addEntry(s?.barcodeId || s?.confirmBarcodeId || s?.barcode, s?.sampleType || s?.typeOfSample, s?.testNames)
                );
            });
        }

        if (Array.isArray(report?.sampleDetails)) {
            report.sampleDetails.forEach((s) =>
                addEntry(s?.barcodeId || s?.confirmBarcodeId || s?.barcode, s?.sampleType || s?.typeOfSample, s?.testNames)
            );
        }

        const bookingTable = report?.bookingTableData || bookingData?.tableData || [];
        if (Array.isArray(bookingTable)) {
            bookingTable.forEach((row) =>
                addEntry(
                    row?.confirmBarcodeId || row?.barcodeId || row?.barcode,
                    row?.sampleType || row?.typeOfSample,
                    [row?.testName, row?.panelName, row?.title].filter(Boolean)
                )
            );
        }

        const acceptedList = bookingData?.acceptedbarcode || report?.acceptedbarcode || [];
        if (Array.isArray(acceptedList)) {
            acceptedList.forEach((item) => {
                if (typeof item === 'string') {
                    addEntry(item, '', []);
                } else if (item && typeof item === 'object') {
                    addEntry(
                        item?.barcode || item?.barcodeId || item?.confirmBarcodeId,
                        item?.sampleType || item?.typeOfSample,
                        item?.testandpannelArray || item?.testNames || item?.testName
                    );
                }
            });
        }

        return entries;
    }

    /**
     * Resolves the EXACT specimen `{ barcodeId, sampleType }` corresponding to a
     * category/panel section so each page displays its own specimen's barcode.
     */
    function resolveSpecimenForCategory(categoryData, report, bookingData) {
        // 1. Direct section-level sampleDetails (highest specificity)
        const secSamples = Array.isArray(categoryData?.sampleDetails) ? categoryData.sampleDetails : [];
        const sectionTestNames = new Set();
        [categoryData?.panelName, categoryData?.title, categoryData?.category]
            .map(normalizeText)
            .filter(Boolean)
            .forEach((n) => sectionTestNames.add(n));
        (categoryData?.tests || []).forEach((t) => {
            [t?.Name, t?.testName].map(normalizeText).filter(Boolean).forEach((n) => sectionTestNames.add(n));
        });

        const scoreCandidate = (cand) => {
            let hits = 0;
            (cand.testNames || []).forEach((tn) => {
                if (sectionTestNames.has(tn)) {
                    hits += 3;
                } else {
                    for (const st of sectionTestNames) {
                        if (st.includes(tn) || tn.includes(st)) hits += 1;
                    }
                }
            });
            return hits;
        };

        if (secSamples.length) {
            let bestSec = null;
            let bestScore = -1;
            secSamples.forEach((s) => {
                const bid = String(s?.barcodeId || s?.confirmBarcodeId || s?.barcode || '').trim();
                const stype = String(s?.sampleType || s?.typeOfSample || '').trim();
                if (!bid && !stype) return;
                const sc = scoreCandidate({
                    testNames: Array.isArray(s?.testNames) ? s.testNames.map(normalizeText) : [],
                });
                if (!bestSec || sc > bestScore) {
                    bestSec = { barcodeId: bid, sampleType: stype };
                    bestScore = sc;
                }
            });
            if (bestSec && bestSec.barcodeId) return bestSec;
        }

        // 2. Match against all report/booking specimen entries by test/panel name
        const allEntries = collectAllSpecimenEntries(report, bookingData);
        let bestMatch = null;
        let bestHits = 0;
        allEntries.forEach((entry) => {
            if (!entry.barcodeId) return;
            const hits = scoreCandidate(entry);
            if (hits > bestHits) {
                bestHits = hits;
                bestMatch = { barcodeId: entry.barcodeId, sampleType: entry.sampleType };
            }
        });
        if (bestMatch) return bestMatch;

        // 3. Fallback to first available specimen barcode on report/booking before falling back to bookingId
        const firstValidSpecimen = allEntries.find((e) => e.barcodeId);
        if (firstValidSpecimen) {
            return {
                barcodeId: firstValidSpecimen.barcodeId,
                sampleType: firstValidSpecimen.sampleType || '',
            };
        }

        // 4. Last-resort fallback only if zero specimen barcodes exist anywhere
        return {
            barcodeId: String(report?.bookingId || ''),
            sampleType: secSamples[0]?.sampleType || '',
        };
    }

    /* =========================================================================
     * 2. API HYDRATION
     * ========================================================================= */

    async function fetchReportData(value1) {
        const response = await fetch(`${BASE_URL}/api/v1/user/ReportData`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value1 }),
            signal,
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch report (${response.status})`);
        }
        return await response.json();
    }

    async function fetchBookingDetailsSafe(bookingId) {
        try {
            const cachedRaw = localStorage.getItem('booking');
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                if (cached && String(cached.bookingId) === String(bookingId) && (cached.acceptedbarcode || cached.tableData)) {
                    return cached;
                }
            }
        } catch (_) { /* ignore cache parse */ }

        if (!bookingId) return null;
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getbooking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value1: bookingId }),
                signal,
            });
            if (!response.ok) return null;
            return await response.json();
        } catch (_) {
            return null;
        }
    }

    async function fetchTemplateLetterhead() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/templates`, {
                method: 'POST',
                signal,
            });
            if (!response.ok) return '';
            const data = await response.json();
            return data?.urls?.[0]?.template || '';
        } catch (_) {
            return '';
        }
    }

    async function fetchDoctorsSignatures() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getDoctorsSign`, { signal });
            if (!response.ok) return null;
            return await response.json();
        } catch (_) {
            return null;
        }
    }

    async function fetchBarcodeImage(codeNumber) {
        const cleanNum = String(codeNumber || '').trim();
        if (!cleanNum) return '';
        if (state.barcodeMap.has(cleanNum)) return state.barcodeMap.get(cleanNum);

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/generate-barcode?nonumber=false`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: cleanNum }),
                signal,
            });
            if (!response.ok) return '';
            const data = await response.json();
            const b64 = await imageToBase64(data?.barcode || '');
            if (b64) state.barcodeMap.set(cleanNum, b64);
            return b64;
        } catch (_) {
            return '';
        }
    }

    async function fetchQrCodeImage(targetUrl) {
        if (!targetUrl) return '';
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/generate-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ link: targetUrl }),
                signal,
            });
            if (!response.ok) return '';
            const data = await response.json();
            return data?.qrCode || '';
        } catch (_) {
            return '';
        }
    }

    function hydratePrintSettings(reportData, doctorsSign) {
        const ps = reportData?.printSettings || {};
        const docSign = doctorsSign || {};

        let lsPrint = {};
        try {
            lsPrint = JSON.parse(localStorage.getItem('printSettings') || '{}') || {};
        } catch (_) {
            lsPrint = {};
        }

        const pick = (...vals) => {
            for (const v of vals) {
                if (v !== undefined && v !== null && v !== '') return v;
            }
            return undefined;
        };

        state.settings.headermargin = parseNum(pick(ps.headermargin, lsPrint.headermargin), 2.8, 0, 10);
        state.settings.footermargin = parseNum(pick(ps.footermargin, lsPrint.footermargin), 1.0, 0, 6);
        state.settings.marginLeft = parseNum(pick(ps.marginLeft, lsPrint.marginLeft), 0, 0, 4);
        state.settings.marginRight = parseNum(pick(ps.marginRight, lsPrint.marginRight), 0, 0, 4);
        state.settings.headerContentGap = parseNum(pick(ps.headerContentGap, lsPrint.headerContentGap), 0.7, 0.1, 10);
        state.settings.selectedFontSize = parseNum(pick(ps.selectedFontSize, lsPrint.selectedFontSize), 10.5, 8, 18);
        state.settings.RowSpacing = parseNum(pick(ps.RowSpacing, lsPrint.RowSpacing), 1, 0, 12);

        state.settings.HighLow = parseBool(pick(ps.HighLow, lsPrint.HighLow), true);
        state.settings.HLinred = parseBool(pick(ps.HLinred, lsPrint.HLinred), true);
        state.settings.BoldRow = parseBool(pick(ps.BoldRow, lsPrint.BoldRow), false);
        // Per request, Investigations always remains enabled in Format 5 header when tests exist
        state.settings.showInvest = true;
        state.settings.showCategory = parseBool(pick(ps.showCategory, lsPrint.showCategory), true);
        state.settings.showTestHeading = parseBool(pick(ps.showTestHeading, lsPrint.showTestHeading), true);

        state.settings.showlab = parseBool(pick(docSign.showlabinchargesign, ps.showlab, reportData?.showLabIncharge), false);
        state.settings.showdoctorfirst = parseBool(pick(docSign.showfirstdoctorsign, ps.showdoctorfirst), true);
        state.settings.showdoctorsecond = parseBool(pick(docSign.showseconddoctorsign, ps.showdoctorsecond), true);

        state.settings.fileInputLab = pick(docSign.labinchargesign, ps.fileInputLab, '') || '';
        state.settings.fileInputDoctorleft = pick(docSign.firstdoctorsign, ps.fileInputDoctorleft, '') || '';
        state.settings.fileInputDoctorright = pick(docSign.seconddoctorsign, ps.fileInputDoctorright, '') || '';

        state.settings.fileInputLabtext = pick(docSign.labinchargeinfo, ps.fileInputLabtext, '') || '';
        state.settings.fileInputDoctorlefttext = pick(docSign.firstdoctorsigninfo, ps.fileInputDoctorlefttext, '') || '';
        state.settings.fileInputDoctorrighttext = pick(docSign.seconddoctorsigninfo, ps.fileInputDoctorrighttext, '') || '';

        state.settings.nablLogoUrl = reportData?.nablLogo || ps?.nablLogoUrl || '';
        state.settings.nablSettings = reportData?.nablSettings || ps || null;

        if (ps.backgroundImageUrl && !state.backgroundImageUrl) {
            state.backgroundImageUrl = ps.backgroundImageUrl;
        }

        const gapInput = document.getElementById('oh5RowGapInput');
        const gapVal = document.getElementById('oh5RowGapVal');
        if (gapInput) gapInput.value = String(state.settings.RowSpacing);
        if (gapVal) gapVal.textContent = String(state.settings.RowSpacing);
    }

    /* =========================================================================
     * 3. FORMAT 5 DOM BUILDERS (HEADER, BODY SECTIONS, COMPACT FOOTER)
     * ========================================================================= */

    function getChronologicalTimestamps(report) {
        const regStr = formatClinicalDate(report.registeredOn || report.date || report.createdAt, report.registeredOn ? '' : report.time);
        const collStr = formatClinicalDate(report.collectedOn) || regStr;
        const recStr = formatClinicalDate(report.receivedOn) || collStr;
        const repStr = formatClinicalDate(report.reportedOn || new Date().toISOString()) || recStr;
        return { regStr, collStr, recStr, repStr };
    }

    /**
     * Resolves concise clinical Investigation display text using Short_name for
     * Tests & Panels and exact packageName for Packages.
     */
    function resolveShortInvestigationText(report) {
        if (Array.isArray(report?.investigationShortNames) && report.investigationShortNames.length > 0) {
            return report.investigationShortNames.filter(Boolean).join(', ');
        }

        const shortLookup = new Map();
        const addAlias = (full, shortVal) => {
            const f = normalizeText(full);
            const s = String(shortVal ?? '').trim();
            if (f && s) shortLookup.set(f, s);
        };

        (report?.CategoryAndTest || []).forEach((cat) => {
            if (!cat) return;
            if (cat.panelName && cat.Short_name) addAlias(cat.panelName, cat.Short_name);
            if (cat.title && cat.Short_name) addAlias(cat.title, cat.Short_name);
            (cat.tests || []).forEach((t) => {
                const full = t?.Name || t?.testName;
                const sh = t?.Short_name || t?.shortName || t?.defaultShortName;
                if (full && sh) addAlias(full, sh);
            });
        });

        const tokens = [];
        const seen = new Set();
        const pushToken = (rawName, explicitShort = '') => {
            const clean = String(rawName ?? '').trim();
            if (!clean) return;
            const resolved = String(explicitShort || shortLookup.get(normalizeText(clean)) || clean).trim();
            const key = normalizeText(resolved);
            if (!seen.has(key)) {
                seen.add(key);
                tokens.push(resolved);
            }
        };

        if (Array.isArray(report?.uniquetestArray) && report.uniquetestArray.length) {
            report.uniquetestArray.forEach((item) => {
                const whole = String(item ?? '').trim();
                if (!whole) return;
                if (shortLookup.has(normalizeText(whole))) {
                    pushToken(whole);
                } else {
                    whole.split(',').map((s) => s.trim()).filter(Boolean).forEach((part) => pushToken(part));
                }
            });
        } else if (typeof report?.uniquetestArray === 'string' && report.uniquetestArray.trim()) {
            report.uniquetestArray.split(',').map((s) => s.trim()).filter(Boolean).forEach((part) => pushToken(part));
        } else if (Array.isArray(report?.CategoryAndTest)) {
            report.CategoryAndTest.forEach((cat) => {
                if (cat?.packageName) {
                    pushToken(cat.packageName);
                } else if (cat?.panelName || (cat?.title && !String(cat.title).includes('Unknown Title'))) {
                    pushToken(cat.panelName || cat.title, cat.Short_name || '');
                } else if (cat?.category) {
                    pushToken(cat.category);
                }
            });
        }

        return tokens.join(', ');
    }

    /**
     * Builds the compact Format 5 Header Card dynamically tailored to an active
     * specimen `{ barcodeId, sampleType }`.
     * Left column: Referral / Lab / Contact / Specimen
     * Right column: Compact 2×2 Specimen Timestamps + Short-Name Investigations
     * (Automatically spans full card width cleanly if > 85 chars / many booked tests!)
     */
    function buildHeaderElement(report, specimenOverride = null) {
        const { regStr, collStr, recStr, repStr } = getChronologicalTimestamps(report);
        const activeSpecimen = specimenOverride?.barcodeId
            ? specimenOverride
            : state.defaultSpecimen;

        const barcodeNumber = activeSpecimen?.barcodeId || report.bookingId || '';
        const barcodeImgUrl = state.barcodeMap.get(barcodeNumber) || '';
        const sampleDisplay = activeSpecimen?.sampleType
            ? `${activeSpecimen.sampleType}${activeSpecimen.barcodeId ? ` (${activeSpecimen.barcodeId})` : ''}`
            : (activeSpecimen?.barcodeId ? `Barcode: ${activeSpecimen.barcodeId}` : 'Standard Specimen');

        const ageText = report.year ? `${report.year} Y` : '';
        const genderText = report.gender ? String(report.gender) : '';
        const ageGenderBadge = [ageText, genderText].filter(Boolean).join(' / ') || 'N/A';

        const leftRows = [
            { label: 'Ref. By', val: report.doctorName || 'Self' },
            ...(!isLayerOneTenant ? [{ label: 'Lab / Client', val: report.labName || 'Direct' }] : []),
            { label: 'Contact', val: report.phone || report.address || '—' },
            { label: 'Specimen', val: sampleDisplay, id: 'oh5HeaderSpecimenVal' },
        ];

        const investNames = resolveShortInvestigationText(report);
        const isLongInvest = investNames.length > 85;
        const investHtml = investNames
            ? `<div class="oh5-header-invest investigationDiv${isLongInvest ? ' oh5-header-invest--full' : ''}" id="investDiv">
                   <span class="tags oh5-invest-label">Investigations :</span>
                   <span class="value oh5-invest-value" data-field="uniquetestArray">${escapeHtml(investNames)}</span>
               </div>`
            : '';

        const card = document.createElement('div');
        card.className = 'oh5-header-card';
        card.setAttribute('data-active-barcode', barcodeNumber);
        card.innerHTML = `
            <div class="oh5-header-top-band">
                <div class="oh5-patient-identity">
                    <span class="oh5-patient-name" data-field="patientName">${escapeHtml(report.patientName || 'Patient')}</span>
                    <span class="oh5-age-gender" data-field="ageSex">${escapeHtml(ageGenderBadge)}</span>
                    <span class="oh5-uhid-pill">Reg/Booking: ${escapeHtml(report.reg_id || report.bookingId || '—')}</span>
                </div>
                <div class="oh5-barcode-box">
                    <div class="oh5-barcode-img-slot">
                        ${barcodeImgUrl
                            ? `<img id="barcodeImage" src="${escapeHtml(barcodeImgUrl)}" alt="Specimen Barcode ${escapeHtml(barcodeNumber)}" />`
                            : ''}
                    </div>
                    <div class="oh5-accession-badge">
                        <span class="oh5-accession-label">Specimen Barcode</span>
                        <span class="oh5-accession-id" id="oh5HeaderBarcodeLabel" data-field="specimenBarcode">${escapeHtml(barcodeNumber || '—')}</span>
                    </div>
                </div>
            </div>

            <div class="oh5-header-grid">
                <div class="oh5-patient-col">
                    <table class="oh5-meta-table">
                        <tbody>
                            ${leftRows.map((r) => `
                                <tr>
                                    <td class="oh5-meta-label">${escapeHtml(r.label)}</td>
                                    <td class="oh5-meta-sep">:</td>
                                    <td class="oh5-meta-val"${r.id ? ` id="${r.id}"` : ''}>${escapeHtml(r.val)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="oh5-specimen-col">
                    <div class="oh5-ts-grid">
                        <div class="oh5-ts-item"><span class="oh5-ts-lbl">Reg:</span>${escapeHtml(regStr || '—')}</div>
                        <div class="oh5-ts-item"><span class="oh5-ts-lbl">Rep:</span>${escapeHtml(repStr || '—')}</div>
                        <div class="oh5-ts-item"><span class="oh5-ts-lbl">Coll:</span>${escapeHtml(collStr || '—')}</div>
                        <div class="oh5-ts-item"><span class="oh5-ts-lbl">Rec:</span>${escapeHtml(recStr || '—')}</div>
                    </div>
                    ${!isLongInvest ? investHtml : ''}
                </div>
            </div>

            ${isLongInvest ? investHtml : ''}
        `;
        return card;
    }

    function buildSignatureCredHtml(rawText) {
        const lines = String(rawText ?? '')
            .replace(/<br\s*\/?>/gi, '\n')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        if (!lines.length) return '';
        const [first, ...rest] = lines;
        return `<span class="oh5-sign-name">${escapeHtml(first)}</span>${
            rest.length ? `<span class="oh5-sign-role">${rest.map(escapeHtml).join('<br>')}</span>` : ''
        }`;
    }

    function buildFooterElement() {
        const s = state.settings;
        const wrap = document.createElement('div');
        wrap.className = 'oh5-footer-wrap';

        const makeSlotHtml = (id, slotClass, visible, imgSrc, credText, alt) => `
            <div class="oh5-sign-slot ${slotClass} ${visible ? '' : 'oh5-sign-hidden'}" id="${id}">
                <div class="oh5-sign-img-wrap">
                    ${imgSrc ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(alt)}" class="oh5-sign-img" />` : ''}
                </div>
                <div class="oh5-sign-rule"></div>
                <div class="oh5-sign-cred">${buildSignatureCredHtml(credText)}</div>
            </div>
        `;

        wrap.innerHTML = `
            <div class="oh5-footer-top-row">
                <div class="oh5-qr-block" id="qrBlock">
                    ${state.qrDataUrl
                        ? `<img id="qrimg" class="oh5-qr-img" src="${escapeHtml(state.qrDataUrl)}" alt="Verify Report QR" />`
                        : '<div style="width:44px;height:44px;background:#e2e8f0;border-radius:3px;"></div>'}
                    <div class="oh5-qr-caption">
                        <span class="oh5-qr-title">Scan to Verify</span>
                    </div>
                </div>
                <div class="signatures oh5-signatures">
                    ${makeSlotHtml('labInchargeSign', 'oh5-sign-lab', s.showlab, s.fileInputLab, s.fileInputLabtext, 'Lab In-Charge Signature')}
                    ${makeSlotHtml('firstDoctorSign', 'oh5-sign-doc1', s.showdoctorfirst, s.fileInputDoctorleft, s.fileInputDoctorlefttext, 'Pathologist Signature')}
                    ${makeSlotHtml('secondDoctorSign', 'oh5-sign-doc2', s.showdoctorsecond, s.fileInputDoctorright, s.fileInputDoctorrighttext, 'Authorized Signatory')}
                </div>
            </div>
        `;
        return wrap;
    }

    function sanitizeCategories(categories) {
        if (!Array.isArray(categories)) return [];
        return categories
            .map((cat) => {
                if (!cat) return null;
                const validTests = (cat.tests || []).filter((t) => {
                    if (!t) return false;
                    if (t.isDocumented || t.isInterpretation || t.isMultiHeader) return true;
                    if (Array.isArray(t.parameters) && t.parameters.length > 0) return true;
                    const valStr = String(t.value ?? t.result ?? '').trim();
                    const hasMeta = Boolean(t.remark || t.details);
                    return valStr.length > 0 || hasMeta || Boolean(t.Name || t.testName);
                });
                if (!validTests.length && !cat.interpretation && !cat.advice && !cat.notes && !cat.remarks) {
                    return null;
                }
                return { ...cat, tests: validTests };
            })
            .filter(Boolean);
    }

    function buildFlagSlotInnerHtml(flag, isHighLowEnabled, isRedEnabled) {
        if (!flag || !isHighLowEnabled) return '';
        return `<span class="HL"><span class="oh5-flag-badge${isRedEnabled ? ' is-red' : ''}">${escapeHtml(flag)}</span></span>`;
    }

    function createParameterRow({ catIndex, testIndex, paramIndex = null, title, method, value, unit, reference, isSubParam = false }) {
        const cleanTitle = stripHtmlTags(title);
        const cleanMethod = stripHtmlTags(method);
        const safeVal = value === null || value === undefined || String(value) === 'null' ? '' : String(value);
        const safeUnit = unit === null || unit === undefined || String(unit) === 'null' ? '' : String(unit);
        const safeRef = reference === null || reference === undefined || String(reference) === 'null' ? '' : String(reference);

        const evalRes = evaluateReferenceFlag(safeVal, safeRef);
        const s = state.settings;

        const tr = document.createElement('tr');
        tr.className = `oh5-test-row${isSubParam ? ' oh5-param-row parameter-row' : ''}`;
        tr.setAttribute('data-test-name', cleanTitle);
        if (evalRes.isAbnormal) {
            tr.classList.add('oh5-row--abnormal', 'BoldRow');
            if (s.BoldRow) tr.classList.add('is-bold-row');
        }

        const redClass = s.HLinred ? ' is-red' : '';
        const flagHtml = buildFlagSlotInnerHtml(evalRes.flag, s.HighLow, s.HLinred);

        const titleHtml = isSubParam
            ? `<span class="oh5-param-indent"><span class="oh5-test-title test-name">${escapeHtml(cleanTitle)}</span></span>`
            : `<span class="oh5-test-title test-name">${escapeHtml(cleanTitle)}</span>`;

        const methodHtml = cleanMethod
            ? `<span class="methods oh5-method-note">Method: ${escapeHtml(cleanMethod)}</span>`
            : '';

        tr.innerHTML = `
            <td>
                ${titleHtml}
                ${methodHtml}
            </td>
            <td class="oh5-col-result-cell${evalRes.isAbnormal ? ' high-low' : ''}">
                <div class="oh5-result-wrap">
                    <span class="oh5-result-spacer" aria-hidden="true"></span>
                    <span class="oh5-result-value cell-edit${evalRes.isAbnormal ? ` is-abnormal${redClass}` : ''}"
                          contenteditable="true"
                          spellcheck="false"
                          data-cat-idx="${catIndex}"
                          data-test-idx="${testIndex}"
                          ${paramIndex !== null ? `data-param-idx="${paramIndex}"` : ''}
                          data-field="value"
                          title="Click to edit observed result inline">${escapeHtml(safeVal)}</span>
                    <span class="oh5-flag-slot">${flagHtml}</span>
                </div>
            </td>
            <td class="oh5-unit-cell">
                <span class="cell-edit"
                      contenteditable="true"
                      spellcheck="false"
                      data-cat-idx="${catIndex}"
                      data-test-idx="${testIndex}"
                      ${paramIndex !== null ? `data-param-idx="${paramIndex}"` : ''}
                      data-field="unit">${escapeHtml(safeUnit)}</span>
            </td>
            <td class="oh5-ref-block">
                <span class="oh5-ref-text cell-edit"
                      contenteditable="true"
                      spellcheck="false"
                      data-cat-idx="${catIndex}"
                      data-test-idx="${testIndex}"
                      ${paramIndex !== null ? `data-param-idx="${paramIndex}"` : ''}
                      data-field="reference">${escapeHtml(safeRef)}</span>
            </td>
        `;

        tr.querySelectorAll('.cell-edit').forEach((cell) => {
            cell.addEventListener('blur', () => handleInlineCellEdit(cell, tr));
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && cell.getAttribute('data-field') !== 'reference') {
                    e.preventDefault();
                    cell.blur();
                }
            });
        });

        return tr;
    }

    function handleInlineCellEdit(cellEl, rowEl) {
        const catIdx = Number(cellEl.getAttribute('data-cat-idx'));
        const testIdx = Number(cellEl.getAttribute('data-test-idx'));
        const paramIdxAttr = cellEl.getAttribute('data-param-idx');
        const field = cellEl.getAttribute('data-field');
        const newValue = (cellEl.textContent || '').trim();

        const cat = state.report?.CategoryAndTest?.[catIdx];
        const test = cat?.tests?.[testIdx];
        if (!test) return;

        let targetObj = test;
        if (paramIdxAttr !== null && Array.isArray(test.parameters)) {
            targetObj = test.parameters[Number(paramIdxAttr)] || test;
        }

        if (field === 'value') {
            if ('value' in targetObj || paramIdxAttr === null) targetObj.value = newValue;
            else targetObj.result = newValue;
        } else if (field === 'unit') {
            targetObj.unit = newValue;
        } else if (field === 'reference') {
            if ('reference' in targetObj || paramIdxAttr === null) targetObj.reference = newValue;
            else targetObj.text = newValue;
        }

        const currentVal = (rowEl.querySelector('[data-field="value"]')?.textContent || '').trim();
        const currentRef = (rowEl.querySelector('[data-field="reference"]')?.textContent || '').trim();
        const evalRes = evaluateReferenceFlag(currentVal, currentRef);
        const s = state.settings;

        const valCell = rowEl.children[1];
        const valSpan = rowEl.querySelector('[data-field="value"]');
        const flagSlot = rowEl.querySelector('.oh5-flag-slot');

        rowEl.classList.remove('oh5-row--abnormal', 'BoldRow', 'is-bold-row');
        if (valCell) valCell.classList.remove('high-low');
        if (valSpan) valSpan.classList.remove('is-abnormal', 'is-red');
        if (flagSlot) flagSlot.innerHTML = '';

        if (evalRes.isAbnormal) {
            rowEl.classList.add('oh5-row--abnormal', 'BoldRow');
            if (s.BoldRow) rowEl.classList.add('is-bold-row');
            if (valCell) valCell.classList.add('high-low');
            if (valSpan) {
                valSpan.classList.add('is-abnormal');
                if (s.HLinred) valSpan.classList.add('is-red');
            }
            if (flagSlot) {
                flagSlot.innerHTML = buildFlagSlotInnerHtml(evalRes.flag, s.HighLow, s.HLinred);
            }
        }

        clearTimeout(state.saveTimer);
        state.saveTimer = setTimeout(() => {
            saveCurrentSnapshot({ silent: true });
        }, 700);
    }

    function createCalloutCard(titleText, htmlBody, extraClass = '') {
        const cleanHtml = sanitizeRichHtml(htmlBody);
        const temp = document.createElement('div');
        temp.innerHTML = cleanHtml;
        if (!temp.textContent.replace(/\u00a0/g, ' ').trim() && !temp.querySelector('img, table, ul, ol')) {
            return null;
        }

        const card = document.createElement('div');
        card.className = `oh5-interpretation-card interpretation ${extraClass}`;
        card.innerHTML = `
            <span class="oh5-interpretation-title">${escapeHtml(titleText)}</span>
            <div class="documented-content">${cleanHtml}</div>
        `;
        return card;
    }

    /**
     * Parses `report.CategoryAndTest` into clean semantic sections:
     * - Attaches `data-specimen-barcode`, `data-specimen-type`, `data-specimen-barcode-img`
     *   to each `.oh5-category-section`.
     * - Places BOTH `.oh5-category-banner` AND `.oh5-profile-banner` cleanly OUTSIDE
     *   and ABOVE each `<table class="oh5-results-table">`.
     */
    function buildBodySections(report) {
        state.categoryNodes = [];
        state.remarksNode = null;

        const sanitizedCats = sanitizeCategories(report.CategoryAndTest || []);
        const rawCats = report.CategoryAndTest || [];

        sanitizedCats.forEach((cat, safeIdx) => {
            const origCatIdx = rawCats.findIndex((raw) => raw === cat || (raw?.category === cat.category && raw?.title === cat.title));
            const catIdx = origCatIdx >= 0 ? origCatIdx : safeIdx;

            const section = document.createElement('section');
            section.className = 'section oh5-category-section';

            const catTitle = String(cat.category || '').trim();
            const isPanel = cat.type === 'panel' || (cat.title && cat.title !== cat.category && !String(cat.title).includes('Unknown Title'));
            const panelTitle = isPanel ? String(cat.panelName || cat.title || '').trim() : '';

            const specimen = resolveSpecimenForCategory(cat, report, state.bookingData);
            const specimenImg = state.barcodeMap.get(specimen.barcodeId) || '';

            section.setAttribute('data-category-name', catTitle);
            if (panelTitle) section.setAttribute('data-panel-name', panelTitle);
            if (cat.packageName) section.setAttribute('data-package-name', cat.packageName);
            section.setAttribute('data-specimen-barcode', specimen.barcodeId || '');
            section.setAttribute('data-specimen-type', specimen.sampleType || '');
            if (specimenImg) section.setAttribute('data-specimen-barcode-img', specimenImg);

            if (report.categorizedPDF && safeIdx > 0) {
                section.classList.add('page-break', 'oh5-page-break-before');
            }

            // 1. Category / Department Banner ABOVE table
            if (state.settings.showCategory && catTitle) {
                const banner = document.createElement('div');
                banner.className = 'section-heading-main oh5-category-banner';
                banner.innerHTML = `<span>${escapeHtml(catTitle)}</span>`;
                section.appendChild(banner);
            }

            let currentTable = null;
            let currentTbody = null;

            const closeTable = () => {
                currentTable = null;
                currentTbody = null;
            };

            const appendProfileBanner = (headingText) => {
                if (!headingText || !state.settings.showTestHeading) return;
                closeTable();
                const prof = document.createElement('div');
                prof.className = 'section-heading-sub oh5-profile-banner';
                prof.innerHTML = `<span>${escapeHtml(headingText.toUpperCase())}</span>`;
                section.appendChild(prof);
            };

            const ensureTable = () => {
                if (currentTable && currentTbody) return currentTbody;
                currentTable = document.createElement('table');
                currentTable.className = 'oh5-results-table';
                currentTable.innerHTML = `
                    <thead>
                        <tr>
                            <th>Investigation / Parameter</th>
                            <th class="oh5-col-val">Observed Result</th>
                            <th>Unit</th>
                            <th>Biological Ref. Interval</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                `;
                currentTbody = currentTable.querySelector('tbody');
                section.appendChild(currentTable);
                return currentTbody;
            };

            // 2. Panel Banner cleanly ABOVE table (not inside tbody)
            if (panelTitle) {
                appendProfileBanner(panelTitle);
            }

            (cat.tests || []).forEach((test, tIdx) => {
                if (test.isInterpretation) {
                    closeTable();
                    const card = createCalloutCard('Clinical Interpretation', test.details || '');
                    if (card) section.appendChild(card);
                    return;
                }

                if (test.isDocumented) {
                    closeTable();
                    const docCard = document.createElement('div');
                    docCard.className = 'documented-content oh5-documented-card';
                    docCard.innerHTML = sanitizeRichHtml(test.testName || '');
                    section.appendChild(docCard);
                    return;
                }

                if (Array.isArray(test.parameters) && test.parameters.length > 1) {
                    const profileName = stripHtmlTags(test.Name || test.testName || '');
                    // Place nested profile heading ABOVE its dedicated table
                    if (profileName && normalizeText(profileName) !== normalizeText(panelTitle)) {
                        appendProfileBanner(profileName);
                    }
                    const tbody = ensureTable();
                    test.parameters.forEach((param, pIdx) => {
                        tbody.appendChild(createParameterRow({
                            catIndex: catIdx,
                            testIndex: tIdx,
                            paramIndex: pIdx,
                            title: param.Para_name || param.parameterName || param.name || '',
                            method: param.method || '',
                            value: param.value ?? param.result ?? param.defaultresult ?? '',
                            unit: param.unit || '',
                            reference: param.reference ?? param.text ?? '',
                            isSubParam: true,
                        }));
                    });

                    if (test.remark) {
                        closeTable();
                        const c = createCalloutCard('Clinical Remark', escapeHtml(test.remark));
                        if (c) section.appendChild(c);
                    }
                    if (test.details) {
                        closeTable();
                        const c = createCalloutCard('Clinical Note', test.details);
                        if (c) section.appendChild(c);
                    }
                    return;
                }

                const rawName = String(test.Name || test.testName || '');
                const isExplicitParam = Boolean(test.isParameter) || /id=["']parameters["']/.test(rawName);
                const isExplicitMulti = Boolean(test.isMultiHeader);
                const hasEmptyFields =
                    (test.value === null || test.value === undefined || test.value === '' || test.value === 'null') &&
                    !test.unit &&
                    !test.reference;
                const isImplicitHeader = !isExplicitParam && !test.isDocumented && (isExplicitMulti || hasEmptyFields);

                if (isImplicitHeader) {
                    const profName = stripHtmlTags(rawName);
                    if (normalizeText(profName) !== normalizeText(panelTitle)) {
                        appendProfileBanner(profName);
                    }
                } else {
                    const tbody = ensureTable();
                    tbody.appendChild(createParameterRow({
                        catIndex: catIdx,
                        testIndex: tIdx,
                        title: rawName,
                        method: test.method || '',
                        value: test.value ?? test.result ?? '',
                        unit: test.unit || '',
                        reference: test.reference ?? '',
                        isSubParam: isExplicitParam,
                    }));
                }

                if (test.remark) {
                    closeTable();
                    const c = createCalloutCard('Remark', escapeHtml(test.remark));
                    if (c) section.appendChild(c);
                }
                if (test.details && !test.isInterpretation) {
                    closeTable();
                    const c = createCalloutCard('Notes', test.details);
                    if (c) section.appendChild(c);
                }
            });

            [
                cat.advice ? createCalloutCard('Medical Advice', cat.advice) : null,
                cat.notes ? createCalloutCard('Technical Note', cat.notes) : null,
                cat.remarks ? createCalloutCard('Remarks', cat.remarks) : null,
                cat.interpretation ? createCalloutCard('Clinical Interpretation', cat.interpretation) : null,
            ]
                .filter(Boolean)
                .forEach((c) => {
                    closeTable();
                    section.appendChild(c);
                });

            if (section.children.length > 0) {
                state.categoryNodes.push(section);
            }
        });

        if (report.MoreDetails && stripHtmlTags(report.MoreDetails).length > 0) {
            const more = document.createElement('div');
            more.className = 'moreDetails oh5-remarks-card';
            more.innerHTML = `
                <span class="oh5-remarks-title">Additional Findings &amp; Clinical Comments</span>
                <div class="documented-content">${sanitizeRichHtml(report.MoreDetails)}</div>
            `;
            state.remarksNode = more;
        }

        const endMarker = document.createElement('div');
        endMarker.className = 'oh5-end-of-report';
        endMarker.textContent = 'End Of Report';
        state.endNode = endMarker;
    }

    /* =========================================================================
     * 4. TRUE A4 SCREEN PAGINATION & PER-SHEET SPECIMEN BARCODE HEADERS
     * ========================================================================= */

    function applyDynamicPreviewCss() {
        let dynStyle = document.getElementById('oh5DynamicVarsStyle');
        if (!dynStyle) {
            dynStyle = document.createElement('style');
            dynStyle.id = 'oh5DynamicVarsStyle';
            document.head.appendChild(dynStyle);
        }

        const s = state.settings;
        // Exact compact scale: Spacing = 1 -> 0.5px top & bottom; 2 -> 1.2px; 3 -> 1.9px ...
        const rowPadY = s.RowSpacing <= 0 ? '0' : (0.5 + (s.RowSpacing - 1) * 0.7).toFixed(2);
        const fontPx = s.selectedFontSize;
        const subFontPx = Math.max(8, fontPx - 2).toFixed(1);
        const headerFontPx = Math.max(8.5, fontPx - 1.5).toFixed(1);

        dynStyle.textContent = `
            #oh5PageRoot .oh5-results-table tbody td {
                font-size: ${fontPx}px;
                padding-top: ${rowPadY}px;
                padding-bottom: ${rowPadY}px;
            }
            #oh5PageRoot .oh5-results-table thead th {
                font-size: ${headerFontPx}px;
            }
            #oh5PageRoot .oh5-method-note {
                font-size: ${subFontPx}px;
            }
            #oh5PageRoot .oh5-category-banner {
                font-size: ${(fontPx + 1).toFixed(1)}px;
            }
            #oh5PageRoot .oh5-profile-banner {
                font-size: ${fontPx.toFixed(1)}px;
            }
            #oh5PageRoot .oh5-flag-badge {
                display: ${s.HighLow ? 'inline-flex' : 'none'} !important;
            }
            #oh5PageRoot .oh5-result-value.is-abnormal {
                color: ${s.HLinred ? '#b91c1c' : '#0f172a'};
            }
            #oh5PageRoot .oh5-flag-badge {
                background: ${s.HLinred ? '#fef2f2' : '#f1f5f9'};
                color: ${s.HLinred ? '#b91c1c' : '#0f172a'};
                border-color: ${s.HLinred ? '#fca5a5' : '#cbd5e1'};
            }
            #oh5PageRoot .oh5-row--abnormal td {
                font-weight: ${s.BoldRow ? '700' : 'inherit'};
            }
        `;
    }

    function renderPaginatedSheets() {
        applyDynamicPreviewCss();

        const stack = document.getElementById('sheetStackWrap');
        const container = document.getElementById('container');
        if (!stack || !container) return;

        stack.innerHTML = '';
        container.style.display = 'block';

        const s = state.settings;
        const headerMarginPx = Math.round(s.headermargin * CM_TO_PX);
        const footerMarginPx = Math.round(s.footermargin * CM_TO_PX);
        const headerGapPx = Math.round(s.headerContentGap * CM_TO_PX);
        const leftPadPx = DEFAULT_SIDE_PAD_PX + Math.round(s.marginLeft * CM_TO_PX);
        const rightPadPx = DEFAULT_SIDE_PAD_PX + Math.round(s.marginRight * CM_TO_PX);

        const bgUrl = !state.withoutLetterhead ? state.backgroundImageUrl : '';

        const sheetsMeta = [];

        const createSheet = (initialSpecimen = null) => {
            const sheet = document.createElement('div');
            sheet.className = 'oh5-sheet';
            if (bgUrl) {
                sheet.style.backgroundImage = `url("${bgUrl}")`;
            }

            const hdr = document.createElement('div');
            hdr.className = 'oh5-sheet-header';
            hdr.style.padding = `${headerMarginPx}px ${rightPadPx}px ${headerGapPx}px ${leftPadPx}px`;
            hdr.appendChild(buildHeaderElement(state.report, initialSpecimen));

            const body = document.createElement('div');
            body.className = 'oh5-sheet-body';
            body.style.padding = `0 ${rightPadPx}px 0 ${leftPadPx}px`;

            const ftr = document.createElement('div');
            ftr.className = 'oh5-sheet-footer';
            ftr.style.padding = `6px ${rightPadPx}px ${footerMarginPx}px ${leftPadPx}px`;
            if (state.footerElement) {
                ftr.appendChild(state.footerElement.cloneNode(true));
            }
            const metaRow = document.createElement('div');
            metaRow.className = 'oh5-footer-bottom-meta';
            metaRow.innerHTML = `
                <span>Report Format: Format 5 (Executive Clinical Standard)</span>
                <span class="oh5-page-counter"></span>
            `;
            ftr.appendChild(metaRow);

            sheet.appendChild(hdr);
            sheet.appendChild(body);
            sheet.appendChild(ftr);
            stack.appendChild(sheet);

            const rec = {
                sheet,
                body,
                hdr,
                ftr,
                activeSpecimen: initialSpecimen || state.defaultSpecimen,
            };
            sheetsMeta.push(rec);
            return rec;
        };

        const firstCat = state.categoryNodes[0];
        const firstSpec = firstCat
            ? {
                  barcodeId: firstCat.getAttribute('data-specimen-barcode') || state.defaultSpecimen.barcodeId,
                  sampleType: firstCat.getAttribute('data-specimen-type') || state.defaultSpecimen.sampleType,
              }
            : state.defaultSpecimen;

        let current = createSheet(firstSpec);

        const hasRoom = () =>
            current.body.scrollHeight <= current.body.clientHeight + 1 &&
            current.sheet.scrollHeight <= A4_HEIGHT_PX + 2;

        const updateSheetSpecimenHeader = (sheetRec, spec) => {
            if (!spec?.barcodeId) return;
            sheetRec.activeSpecimen = spec;
            sheetRec.hdr.innerHTML = '';
            sheetRec.hdr.appendChild(buildHeaderElement(state.report, spec));
        };

        state.categoryNodes.forEach((catSection, idx) => {
            const catSpecimen = {
                barcodeId: catSection.getAttribute('data-specimen-barcode') || state.defaultSpecimen.barcodeId,
                sampleType: catSection.getAttribute('data-specimen-type') || state.defaultSpecimen.sampleType,
            };

            const specimenChanged =
                idx > 0 &&
                current.body.children.length > 0 &&
                catSpecimen.barcodeId &&
                current.activeSpecimen?.barcodeId &&
                catSpecimen.barcodeId !== current.activeSpecimen.barcodeId;

            const forceNewPage =
                idx > 0 &&
                current.body.children.length > 0 &&
                (catSection.classList.contains('page-break') || specimenChanged);

            if (forceNewPage) {
                current = createSheet(catSpecimen);
            } else if (current.body.children.length === 0) {
                updateSheetSpecimenHeader(current, catSpecimen);
            }

            const fullClone = catSection.cloneNode(true);
            current.body.appendChild(fullClone);
            if (hasRoom()) {
                return;
            }

            current.body.removeChild(fullClone);
            if (current.body.scrollHeight > A4_HEIGHT_PX * 0.72 && current.body.children.length > 0) {
                current = createSheet(catSpecimen);
            }

            let targetSec = document.createElement('section');
            targetSec.className = 'section oh5-category-section';
            current.body.appendChild(targetSec);

            Array.from(catSection.children).forEach((child) => {
                if (child.tagName !== 'TABLE') {
                    const cClone = child.cloneNode(true);
                    targetSec.appendChild(cClone);
                    if (!hasRoom() && targetSec.children.length > 1) {
                        targetSec.removeChild(cClone);
                        current = createSheet(catSpecimen);
                        targetSec = document.createElement('section');
                        targetSec.className = 'section oh5-category-section';
                        targetSec.appendChild(cClone);
                        current.body.appendChild(targetSec);
                    }
                    return;
                }

                const origThead = child.querySelector('thead');
                const origRows = Array.from(child.querySelectorAll('tbody > tr'));

                const makeFreshTable = () => {
                    const tbl = document.createElement('table');
                    tbl.className = child.className;
                    if (origThead) tbl.appendChild(origThead.cloneNode(true));
                    const tb = document.createElement('tbody');
                    tbl.appendChild(tb);
                    return { tbl, tb };
                };

                let { tbl, tb } = makeFreshTable();
                targetSec.appendChild(tbl);

                origRows.forEach((row) => {
                    const rClone = row.cloneNode(true);
                    tb.appendChild(rClone);
                    if (!hasRoom() && tb.children.length > 1) {
                        tb.removeChild(rClone);
                        current = createSheet(catSpecimen);
                        targetSec = document.createElement('section');
                        targetSec.className = 'section oh5-category-section';
                        current.body.appendChild(targetSec);
                        const nextTable = makeFreshTable();
                        tbl = nextTable.tbl;
                        tb = nextTable.tb;
                        tb.appendChild(rClone);
                        targetSec.appendChild(tbl);
                    }
                });
            });
        });

        const tailNodes = [state.remarksNode, state.endNode].filter(Boolean);
        tailNodes.forEach((node) => {
            const clone = node.cloneNode(true);
            current.body.appendChild(clone);
            if (!hasRoom() && current.body.children.length > 1) {
                current.body.removeChild(clone);
                current = createSheet(current.activeSpecimen);
                current.body.appendChild(clone);
            }
        });

        const total = sheetsMeta.length;
        sheetsMeta.forEach(({ sheet }, index) => {
            const counter = sheet.querySelector('.oh5-page-counter');
            if (counter) {
                counter.textContent = `Page ${index + 1} of ${total}`;
            }

            sheet.querySelectorAll('.cell-edit').forEach((cell) => {
                const tr = cell.closest('tr');
                cell.addEventListener('blur', () => handleInlineCellEdit(cell, tr));
                cell.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && cell.getAttribute('data-field') !== 'reference') {
                        e.preventDefault();
                        cell.blur();
                    }
                });
            });
        });
    }

    /* =========================================================================
     * 5. SEMANTIC SNAPSHOT EXTRACTION & PDF PAYLOAD BUILDERS
     * ========================================================================= */

    function buildSemanticSnapshotParts() {
        const headerHtml = state.headerElement ? state.headerElement.outerHTML : '';

        const bodyWrap = document.createElement('div');
        state.categoryNodes.forEach((node) => {
            bodyWrap.appendChild(node.cloneNode(true));
        });
        if (state.remarksNode) {
            bodyWrap.appendChild(state.remarksNode.cloneNode(true));
        }
        if (state.endNode) {
            bodyWrap.appendChild(state.endNode.cloneNode(true));
        }

        const footerHtml = state.footerElement ? state.footerElement.outerHTML : '';

        return {
            header: headerHtml,
            htmlContent: bodyWrap.innerHTML,
            footer: footerHtml,
        };
    }

    async function saveCurrentSnapshot({ silent = false } = {}) {
        if (!state.reportId) return false;
        const s = state.settings;
        const snapshot = buildSemanticSnapshotParts();
        const investigationMargin = Math.round(s.headermargin * CM_TO_PX + 115);

        const payload = {
            reportId: state.reportId,
            bookingId: state.bookingId,
            htmlContent: snapshot.htmlContent,
            cssContent: '',
            header: snapshot.header,
            footer: snapshot.footer,
            backgroundImageUrl: state.backgroundImageUrl || '',
            investigationmargin: investigationMargin,
            headermargin: String(s.headermargin),
            footermargin: String(s.footermargin),
            headerContentGap: s.headerContentGap,
            labinchargesign: s.showlab,
            showlab: s.showlab,
            showdoctorfirst: s.showdoctorfirst,
            showdoctorsecond: s.showdoctorsecond,
            fileInputLab: s.fileInputLab,
            fileInputDoctorleft: s.fileInputDoctorleft,
            fileInputDoctorright: s.fileInputDoctorright,
            fileInputLabtext: s.fileInputLabtext,
            fileInputDoctorlefttext: s.fileInputDoctorlefttext,
            fileInputDoctorrighttext: s.fileInputDoctorrighttext,
            isdocumented: Boolean(state.report?.isDocumented),
            format: effectiveFormat,
        };

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/adding-pdf-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal,
            });
            if (!response.ok) {
                throw new Error(`Save layout failed (${response.status})`);
            }
            if (!silent) {
                toast('Report layout saved cleanly.', 'success');
            }
            return true;
        } catch (err) {
            console.error('[Format5] Snapshot save failed:', err);
            if (!silent) {
                toast(err.message || 'Could not save report layout.', 'error');
            }
            return false;
        }
    }

    async function requestFormat5PdfBlob({ download = false, auditAction = '' } = {}) {
        const s = state.settings;
        const snapshot = buildSemanticSnapshotParts();

        const payload = {
            value1: state.reportId,
            bookingId: state.bookingId,
            reportId: state.reportId,
            checkBox: Boolean(state.withoutLetterhead),
            backgroundImageUrl: state.backgroundImageUrl || '',
            headermargin: String(s.headermargin),
            footermargin: String(s.footermargin),
            marginLeft: String(s.marginLeft),
            marginRight: String(s.marginRight),
            headerContentGap: s.headerContentGap,
            selectedFontSize: s.selectedFontSize,
            RowSpacing: s.RowSpacing,
            HighLow: s.HighLow,
            HLinred: s.HLinred,
            BoldRow: s.BoldRow,
            showInvest: true,
            showCategory: s.showCategory,
            showTestHeading: s.showTestHeading,
            showlab: s.showlab,
            showdoctorfirst: s.showdoctorfirst,
            showdoctorsecond: s.showdoctorsecond,
            fileInputLab: s.fileInputLab,
            fileInputDoctorleft: s.fileInputDoctorleft,
            fileInputDoctorright: s.fileInputDoctorright,
            fileInputLabtext: s.fileInputLabtext,
            fileInputDoctorlefttext: s.fileInputDoctorlefttext,
            fileInputDoctorrighttext: s.fileInputDoctorrighttext,
            htmlContent: snapshot.htmlContent,
            cssContent: '',
            header: snapshot.header,
            footer: snapshot.footer,
            DownloadPdf: Boolean(download),
            format: effectiveFormat,
            ...(auditAction ? { auditAction } : {}),
        };

        const response = await fetch(`${BASE_URL}/api/v1/user/get-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal,
        });

        if (!response.ok) {
            const errJson = await response.json().catch(() => null);
            throw new Error(errJson?.message || `PDF generation failed (${response.status})`);
        }

        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/i);
        const filename = match ? decodeURIComponent(match[1]) : `${(state.report?.patientName || 'Report').replace(/\s+/g, '_')}_Format5.pdf`;

        return {
            blob: await response.blob(),
            filename,
        };
    }

    /* =========================================================================
     * 6. SIGN-OFF, AUDIT TRACKING & INTERACTIVE ACTION BINDINGS
     * ========================================================================= */

    function updateSignOffUI(isSigned) {
        const signBtn = document.getElementById('signOff');
        const pill = document.getElementById('oh5SignStatusPill');
        const lockedBtns = ['downloadPDF', 'sendReport', 'BrowserPrint'];

        if (signBtn) {
            signBtn.classList.toggle('is-signed', isSigned);
            const span = signBtn.querySelector('span');
            if (span) span.textContent = isSigned ? 'Signed Off' : 'Sign Off';
        }

        if (pill) {
            pill.classList.toggle('is-signed', isSigned);
            pill.classList.toggle('is-pending', !isSigned);
            pill.innerHTML = isSigned
                ? '<i class="fas fa-circle-check"></i> Signed Off'
                : '<i class="fas fa-clock"></i> Pending Sign-Off';
        }

        lockedBtns.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.setAttribute('data-signoff-locked', isSigned ? 'false' : 'true');
            const defaultTitle = el.getAttribute('data-default-title') || '';
            el.title = isSigned ? defaultTitle : 'Sign Off report before downloading or sharing';
        });
    }

    function ensureSignedOff() {
        if (state.report?.signOff) return true;
        toast('Please Sign Off the report first.', 'warn');
        const signOffBtn = document.getElementById('signOff');
        if (signOffBtn) signOffBtn.focus();
        return false;
    }

    async function ensureAuditHelper() {
        if (global.ReportActionAudit?.__initialized) return global.ReportActionAudit;
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = `pages/pages/report_action_audit.js?v=${Date.now()}`;
            s.onload = () => resolve(global.ReportActionAudit || null);
            s.onerror = () => resolve(null);
            document.head.appendChild(s);
        });
    }

    async function bindAuditBadges() {
        const helper = await ensureAuditHelper();
        if (!helper || !state.bookingId) return;

        const targets = [
            { id: 'signOff', label: 'Sign Off', action: 'SIGN_OFF' },
            { id: 'enterResult', label: 'Enter Result', action: 'ENTER_RESULT' },
            { id: 'savePDF', label: 'Save', action: 'SAVE_PDF' },
            { id: 'downloadPDF', label: 'Download PDF', action: 'DOWNLOAD' },
            { id: 'sendReport', label: 'Send', action: 'SEND_REPORT' },
            { id: 'BrowserPrint', label: 'Print', action: 'PRINT' },
            { id: 'PDFsetting', label: 'Print Settings', action: 'PRINT_SETTINGS' },
        ];

        try {
            const data = await helper.get(state.bookingId);
            targets.forEach((t) => {
                const btn = document.getElementById(t.id);
                if (btn) helper.attachBadge(btn, state.bookingId, t.id, data);
            });
        } catch (_) { /* ignore audit fetch failure */ }
    }

    function bindEventHandlers() {
        const lhCheckbox = document.getElementById('oh5WithoutLetterhead');
        if (lhCheckbox) {
            lhCheckbox.addEventListener('change', () => {
                state.withoutLetterhead = Boolean(lhCheckbox.checked);
                renderPaginatedSheets();
            }, { signal });
        }

        const gapInput = document.getElementById('oh5RowGapInput');
        const gapVal = document.getElementById('oh5RowGapVal');
        if (gapInput) {
            gapInput.addEventListener('input', () => {
                const nextGap = parseNum(gapInput.value, 1, 0, 12);
                state.settings.RowSpacing = nextGap;
                if (gapVal) gapVal.textContent = String(nextGap);
                renderPaginatedSheets();
            }, { signal });
        }

        const signOffBtn = document.getElementById('signOff');
        if (signOffBtn) {
            signOffBtn.addEventListener('click', async () => {
                if (!state.reportId) return;
                const nextSignOff = !Boolean(state.report?.signOff);
                setButtonLoading('signOff', true);
                try {
                    const headers = { 'Content-Type': 'application/json' };
                    const token = localStorage.getItem('accessToken');
                    if (token) headers.Authorization = `Bearer ${token}`;

                    const res = await fetch(`${BASE_URL}/api/v1/user/editReportsignofffield`, {
                        method: 'POST',
                        headers,
                        credentials: 'include',
                        body: JSON.stringify({ value1: state.reportId, signoff: nextSignOff }),
                        signal,
                    });
                    if (!res.ok) throw new Error('Sign-off request failed');

                    if (state.report) state.report.signOff = nextSignOff;
                    updateSignOffUI(nextSignOff);
                    toast(nextSignOff ? 'Report signed off successfully.' : 'Sign-off removed.', 'success');

                    if (nextSignOff && state.bookingId) {
                        fetch(`${BASE_URL}/api/v1/user/CompleteBookingcontroller`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bookingid: state.bookingId }),
                            signal,
                        }).catch(() => {});
                    }

                    const helper = await ensureAuditHelper();
                    if (helper && state.bookingId) {
                        helper.record({
                            bookingId: state.bookingId,
                            reportId: state.reportId,
                            buttonId: 'signOff',
                            buttonLabel: 'Sign Off',
                            action: 'SIGN_OFF',
                        });
                    }
                } catch (err) {
                    toast(err.message || 'Sign-off failed.', 'error');
                } finally {
                    setButtonLoading('signOff', false);
                }
            }, { signal });
        }

        const enterResultBtn = document.getElementById('enterResult');
        if (enterResultBtn) {
            enterResultBtn.addEventListener('click', async () => {
                if (!state.bookingId) return;
                try {
                    enterResultBtn.disabled = true;
                    const res = await fetch(`${BASE_URL}/api/v1/user/getbooking`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ value1: state.bookingId }),
                        signal,
                    });
                    if (res.ok) {
                        const booking = await res.json();
                        if (booking && (booking.bookingId || booking._id)) {
                            booking.__fullBooking = true;
                            localStorage.setItem('booking', JSON.stringify(booking));
                            localStorage.setItem('regId', JSON.stringify(booking.bookingId || state.bookingId));
                        }
                    }
                    window.open(`${BASE_URL}/admin/admin.html?page=labreport&value1=${encodeURIComponent(state.bookingId)}`, '_blank');
                } finally {
                    enterResultBtn.disabled = false;
                }
            }, { signal });
        }

        const saveBtn = document.getElementById('savePDF');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                setButtonLoading('savePDF', true);
                try {
                    await saveCurrentSnapshot({ silent: false });
                } finally {
                    setButtonLoading('savePDF', false);
                }
            }, { signal });
        }

        const downloadBtn = document.getElementById('downloadPDF');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                if (!ensureSignedOff()) return;
                setButtonLoading('downloadPDF', true);
                try {
                    const { blob, filename } = await requestFormat5PdfBlob({ download: true, auditAction: 'DOWNLOAD' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    toast('Format 5 PDF downloaded successfully.', 'success');
                } catch (err) {
                    toast(err.message || 'Download failed.', 'error');
                } finally {
                    setButtonLoading('downloadPDF', false);
                }
            }, { signal });
        }

        const printBtn = document.getElementById('BrowserPrint');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                if (!ensureSignedOff()) return;
                if (state.bookingId) {
                    if (global.ReportPrintAudit?.record) {
                        global.ReportPrintAudit.record(state.bookingId, 'PRINT', { reportId: state.reportId });
                    } else {
                        fetch(`${BASE_URL}/api/v1/user/print-audit`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'same-origin',
                            body: JSON.stringify({ bookingId: state.bookingId, action: 'PRINT', reportId: state.reportId }),
                        }).catch(() => {});
                    }
                }
                global.print();
            }, { signal });
        }

        const sendReportBtn = document.getElementById('sendReport');
        const modal = document.getElementById('popupModal');
        const closeModalBtn = modal?.querySelector('.close-button');
        const inputBar = document.getElementById('inputField');
        const contactInput = document.getElementById('contactInput');
        const pdfFrame = document.getElementById('pdfFrame');

        const closeModal = () => {
            if (modal) modal.style.display = 'none';
            if (inputBar) inputBar.style.display = 'none';
            if (state.currentPreviewPdfUrl) {
                URL.revokeObjectURL(state.currentPreviewPdfUrl);
                state.currentPreviewPdfUrl = '';
            }
            if (pdfFrame) pdfFrame.src = '';
        };

        if (sendReportBtn && modal) {
            sendReportBtn.addEventListener('click', async () => {
                if (!ensureSignedOff()) return;
                setButtonLoading('sendReport', true);
                try {
                    const { blob } = await requestFormat5PdfBlob({ download: false });
                    if (state.currentPreviewPdfUrl) URL.revokeObjectURL(state.currentPreviewPdfUrl);
                    state.currentPreviewPdfUrl = URL.createObjectURL(blob);
                    if (pdfFrame) pdfFrame.src = state.currentPreviewPdfUrl;
                    if (modal.parentElement !== document.body) {
                        document.body.appendChild(modal);
                    }
                    modal.style.display = 'flex';
                } catch (err) {
                    toast(err.message || 'Could not generate preview for sharing.', 'error');
                } finally {
                    setButtonLoading('sendReport', false);
                }
            }, { signal });
        }

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModal, { signal });
        }
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            }, { signal });
        }

        document.getElementById('smsButton')?.addEventListener('click', () => {
            state.activeShareChannel = 'sms';
            if (inputBar) inputBar.style.display = 'flex';
            if (contactInput) {
                contactInput.type = 'tel';
                contactInput.value = state.report?.phone || '';
                contactInput.placeholder = 'Enter patient mobile number';
            }
        }, { signal });

        document.getElementById('emailButton')?.addEventListener('click', () => {
            state.activeShareChannel = 'email';
            if (inputBar) inputBar.style.display = 'flex';
            if (contactInput) {
                contactInput.type = 'email';
                contactInput.value = state.report?.email || '';
                contactInput.placeholder = 'Enter recipient email address';
            }
        }, { signal });

        document.getElementById('whatsappButton')?.addEventListener('click', () => {
            const msg = encodeURIComponent(`Your Lab test report from OccuHealth. Click below to download:\n${state.qrLinkUrl}`);
            const phone = String(state.report?.phone || '').replace(/\D/g, '');
            const waUrl = phone
                ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${msg}`
                : `https://wa.me/?text=${msg}`;
            window.open(waUrl, '_blank');
        }, { signal });

        document.getElementById('openPdfButton')?.addEventListener('click', () => {
            if (state.currentPreviewPdfUrl) {
                window.open(state.currentPreviewPdfUrl, '_blank');
            }
        }, { signal });

        document.getElementById('sendButton')?.addEventListener('click', async () => {
            const contact = (contactInput?.value || '').trim();
            if (!contact) {
                toast('Please enter a recipient contact first.', 'warn');
                return;
            }
            if (!state.currentPreviewPdfUrl) {
                toast('PDF preview is not ready yet.', 'error');
                return;
            }
            try {
                const pdfRes = await fetch(state.currentPreviewPdfUrl);
                const pdfBlob = await pdfRes.blob();
                const formData = new FormData();
                formData.append('pdf', new File([pdfBlob], 'report_format5.pdf', { type: 'application/pdf' }));

                if (state.activeShareChannel === 'sms') {
                    formData.append('phoneNumber', contact);
                    formData.append('message', 'This is your test report from OccuHealth. Thank you for using our services!');
                    const res = await fetch(`${BASE_URL}/api/v1/user/send-sms`, { method: 'POST', body: formData });
                    if (!res.ok) throw new Error('SMS dispatch failed');
                    toast('SMS sent successfully!', 'success');
                } else if (state.activeShareChannel === 'email') {
                    formData.append('email', contact);
                    formData.append('subject', 'Your Test Report from OccuHealth');
                    formData.append('body', 'Please find your diagnostic test report attached.');
                    const res = await fetch(`${BASE_URL}/api/v1/user/send-email`, { method: 'POST', body: formData });
                    if (!res.ok) throw new Error('Email dispatch failed');
                    toast('Email sent successfully!', 'success');
                }
            } catch (err) {
                toast(err.message || 'Sending report failed.', 'error');
            }
        }, { signal });
    }

    /* =========================================================================
     * 7. INITIALIZATION PIPELINE
     * ========================================================================= */

    async function initReportFormat5() {
        portalOverlaysToBody();

        const skeleton = document.getElementById('oh5Skeleton');
        try {
            if (!state.value1) {
                throw new Error('No booking/report identifier (`value1`) provided.');
            }

            if (activeUser && activeUser.showprintsetting === false) {
                const printSettingWrap = document.getElementById('printsettingbutton');
                if (printSettingWrap) printSettingWrap.style.display = 'none';
            }

            const [reportData, templateBg, doctorsSign] = await Promise.all([
                fetchReportData(state.value1),
                fetchTemplateLetterhead(),
                fetchDoctorsSignatures(),
            ]);

            if (!reportData || !reportData._id) {
                throw new Error('Report data not found for this booking.');
            }

            state.report = reportData;
            state.reportId = String(reportData._id);
            state.bookingId = String(reportData.bookingId || state.value1);
            state.backgroundImageUrl = templateBg || reportData?.printSettings?.backgroundImageUrl || '';
            state.doctorsSign = doctorsSign;

            // Fetch booking details if specimen acceptedbarcode isn't already attached
            state.bookingData = await fetchBookingDetailsSafe(state.bookingId);

            localStorage.setItem('myKey', state.reportId);
            localStorage.setItem('pdfformat', effectiveFormat);

            hydratePrintSettings(reportData, doctorsSign);

            const topSummary = document.getElementById('oh5TopSummary');
            if (topSummary) {
                topSummary.innerHTML = `${escapeHtml(reportData.patientName || 'Patient')} <span>#${escapeHtml(state.bookingId)}</span>`;
            }
            const catPill = document.getElementById('oh5CatModePill');
            if (catPill && reportData.categorizedPDF) {
                catPill.style.display = 'inline-flex';
            }

            // Collect ALL specimen barcodes needed across categories (plus primary specimen)
            const allSpecimens = collectAllSpecimenEntries(reportData, state.bookingData);
            const primaryCatSpec =
                Array.isArray(reportData.CategoryAndTest) && reportData.CategoryAndTest.length
                    ? resolveSpecimenForCategory(reportData.CategoryAndTest[0], reportData, state.bookingData)
                    : (allSpecimens.find((e) => e.barcodeId) || { barcodeId: state.bookingId, sampleType: '' });

            state.defaultSpecimen = primaryCatSpec;

            const uniqueBarcodeNumbers = new Set();
            if (primaryCatSpec.barcodeId) uniqueBarcodeNumbers.add(primaryCatSpec.barcodeId);
            (reportData.CategoryAndTest || []).forEach((cat) => {
                const s = resolveSpecimenForCategory(cat, reportData, state.bookingData);
                if (s?.barcodeId) uniqueBarcodeNumbers.add(s.barcodeId);
            });
            allSpecimens.forEach((e) => {
                if (e.barcodeId) uniqueBarcodeNumbers.add(e.barcodeId);
            });

            state.qrLinkUrl = `${BASE_URL}/pages/pages/download_reports.html?value=${encodeURIComponent(state.reportId)}&id=${encodeURIComponent(tenantId)}&format=${encodeURIComponent(effectiveFormat)}`;

            const [rawQr, b64Lab, b64Doc1, b64Doc2] = await Promise.all([
                fetchQrCodeImage(state.qrLinkUrl),
                imageToBase64(state.settings.fileInputLab),
                imageToBase64(state.settings.fileInputDoctorleft),
                imageToBase64(state.settings.fileInputDoctorright),
                ...Array.from(uniqueBarcodeNumbers).map((bNum) => fetchBarcodeImage(bNum)),
            ]);

            state.qrDataUrl = await imageToBase64(rawQr);
            if (b64Lab) state.settings.fileInputLab = b64Lab;
            if (b64Doc1) state.settings.fileInputDoctorleft = b64Doc1;
            if (b64Doc2) state.settings.fileInputDoctorright = b64Doc2;

            state.headerElement = buildHeaderElement(reportData, state.defaultSpecimen);
            state.footerElement = buildFooterElement();
            buildBodySections(reportData);

            if (skeleton) skeleton.style.display = 'none';
            renderPaginatedSheets();
            updateSignOffUI(Boolean(reportData.signOff));
            bindEventHandlers();
            bindAuditBadges();

            if (!state.hasSavedInitialSnapshot) {
                state.hasSavedInitialSnapshot = true;
                await saveCurrentSnapshot({ silent: true });
            }
        } catch (err) {
            console.error('[Format5] Initialization error:', err);
            if (skeleton) {
                skeleton.innerHTML = `
                    <div style="text-align:center;padding:36px 20px;color:#b91c1c;">
                        <i class="fas fa-triangle-exclamation" style="font-size:28px;margin-bottom:10px;"></i>
                        <h3 style="margin:0 0 6px;font-size:16px;">Unable to load Format 5 Report</h3>
                        <p style="margin:0;color:#475569;font-size:13px;">${escapeHtml(err.message || 'Unexpected error occurred.')}</p>
                    </div>
                `;
            }
            toast(err.message || 'Failed to load report.', 'error');
        }
    }

    global.__oh5Cleanup = () => {
        abortController.abort();
        clearTimeout(state.saveTimer);
        if (state.currentPreviewPdfUrl) {
            URL.revokeObjectURL(state.currentPreviewPdfUrl);
        }
        state.portaledNodes.forEach((n) => {
            try {
                if (n && n.parentElement) n.remove();
            } catch (_) { /* ignore */ }
        });
        state.portaledNodes = [];
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReportFormat5, { once: true, signal });
    } else {
        initReportFormat5();
    }
})(window);
