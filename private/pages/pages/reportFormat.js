/* ============================================================================
    OccuHealth LIS · Pathology Report Layout (Format 1) — redesigned UI layer
    ----------------------------------------------------------------------------
    · Same backend contract as legacy:
        POST /api/v1/user/adding-pdf-data { htmlContent, cssContent, header,
                                            footer, investigationmargin, ... }
        POST /api/v1/user/get-pdf         (Puppeteer render)
    · htmlContent is serialized from a CANONICAL .container2 rebuilt out of the
      paginated sheet stack, so Puppeteer receives the exact legacy structure.
    · New: skeleton boot screen, A4 sheet pagination engine, editable cells
      with data-bind mapping, toasts, responsive continuous mode.
   ============================================================================ */
(function () {
    'use strict';

    /* ========================= TINY DOM HELPERS ========================= */
    const $  = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    const debounce = (fn, wait) => {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
    };

    /* ========================= TOASTS (non-blocking) ========================= */
    const toastStack = document.getElementById('toastStack');
    function toast(message, type) {
        if (!toastStack) return;
        const el = document.createElement('div');
        el.className = 'toast' + (type ? ' toast--' + type : '');
        el.setAttribute('role', 'status');
        const icon = type === 'error' ? 'fa-exclamation-circle'
            : type === 'warn' ? 'fa-exclamation-triangle' : 'fa-check-circle';
        el.innerHTML = '<i class="fas ' + icon + '" aria-hidden="true"></i><span></span>';
        el.querySelector('span').textContent = message;
        toastStack.appendChild(el);
        setTimeout(() => {
            el.classList.add('is-leaving');
            setTimeout(() => el.remove(), 350);
        }, 3600);
    }

    /* ========================= SKELETON BOOT SCREEN ========================= */
    const skeletonScreen = $('#skeletonScreen');
    function hideSkeleton() {
        if (!skeletonScreen || skeletonScreen.classList.contains('is-done')) return;
        skeletonScreen.classList.add('is-done');
        setTimeout(() => { if (skeletonScreen.parentNode) skeletonScreen.remove(); }, 420);
    }
    function showFatalError(message) {
        const box = $('.skel-error');
        if (box) {
            const msgEl = box.querySelector('.skel-error-msg');
            if (msgEl) msgEl.textContent = message || 'Something went wrong.';
            box.classList.add('is-visible');
        }
    }

    /* ========================= STATE ========================= */
    const state = {
        report: null,
        reportId: null,
        backgroundImageUrl: null,
        doctorsData: null,
        bodyChildren: [],      /* canonical ordered children of .container2 */
        sheets: [],
        mode: 'paginated',     /* 'paginated' | 'continuous' */
        editing: false,
        signInfo: { labinchargeinfo: null, sign: null },
        qrCodeReady: false
    };
    const requestState = { download: false, send: false };

    /* Keep the preview in the same A4 pagination mode at every viewport size.
       Narrow screens scroll the canvas instead of compressing PDF geometry. */
    const desktopMQ = window.matchMedia('(min-width: 0px)');

    /* ========================= URL / FILENAME HELPERS (legacy parity) ========================= */
    function getFormattedPdfFileName(reportData) {
        const pName = ((reportData && reportData.patientName) || 'Patient_Report').trim();
        const safeName = pName.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');

        let dateStr = '';
        const dateVal = reportData && (reportData.date || reportData.reportedOn || reportData.createdAt);
        if (dateVal) {
            const d = new Date(dateVal);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                dateStr = '_' + day + '-' + month + '-' + year;
            }
        }
        return safeName + dateStr + '.pdf';
    }

    let urlWithParam = '';
    function setupSession(reportId) {
        const baseUrl = BASE_URL + '/pages/pages/download_reports.html';
        localStorage.setItem('myKey', reportId);
        localStorage.setItem('pdfformat', user.pdfFormat);
        urlWithParam = baseUrl +
            '?value=' + encodeURIComponent(reportId) +
            '&id=' + encodeURIComponent(user.tenantId._id);
    }

    /* ========================= DATA FETCHING ========================= */
    async function fetchreport(value1) {
        const response = await fetch(BASE_URL + '/api/v1/user/ReportData', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value1 })
        });
        if (!response.ok) throw new Error('Report could not be loaded (' + response.status + ')');
        return response.json();
    }

    async function fetchTemplateImages() {
        try {
            const response = await fetch(BASE_URL + '/api/v1/user/templates', { method: 'POST' });
            const data = await response.json();
            if (data && data.urls && Array.isArray(data.urls) && data.urls.length) {
                return data.urls[0].template;
            }
            return null;
        } catch (error) {
            console.warn('Template image fetch skipped:', error);
            return null;
        }
    }

    async function fetchDoctorsSign() {
        try {
            const response = await fetch('/api/v1/user/getDoctorsSign');
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.warn('Doctor sign fetch failed:', error);
            return null;
        }
    }

    /* Legacy helper kept for payload parity (labinchargeinfo/sign in get-pdf call) */
    async function fetchLabSignAndSetInputs() {
        const data = state.doctorsData || (state.doctorsData = await fetchDoctorsSign());
        if (data) {
            return { labinchargeinfo: data.labinchargeinfo, sign: data.labinchargesign };
        }
        return { labinchargeinfo: null, sign: null };
    }

        /* ========================= DATETIME FORMAT (legacy parity) ========================= */
    /* Safely extract the YYYY-MM-DD date part from a date value.
       Returns null for null/undefined/empty/invalid — callers must
       treat null as "no date" so we never call .toISOString() on an
       Invalid Date (which throws RangeError and kills boot). */
    function safeDateISO(dateValue) {
        if (!dateValue) return null;
        const d = new Date(dateValue);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().split('T')[0];
    }

    function formatDateTime(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const amPm = hours >= 12 ? 'PM' : 'AM';
        hours = String(hours % 12 || 12).padStart(2, '0');
        return day + '-' + month + '-' + year + ' <span>' + hours + ':' + minutes + ' ' + amPm + '</span>';
    }

    /* ========================= PATIENT METADATA BAR (.report-details) =========================
       Structure/classes are a snapshot contract — Puppeteer renders this node as
       the repeating PDF page header. data-field attributes map values for DB
       extraction without changing markup shape. */
    function populateHeader() {
        document.getElementById('booking-registeration-number').innerText = state.report.reg_id || '';

        const details = document.createElement('div');
        details.className = 'report-details-innerDiv2';
        details.innerHTML =
            '<div class="left2">' +
                '<div class="infor-div"><div class="tags">Patient Name:</div><div class="value" data-field="patientName">' + (state.report.patientName || '') + '</div></div>' +
                '<div class="infor-div"><div class="tags">Age / Sex:</div><div class="value" data-field="ageSex">' + (state.report.year || '') + ' / ' + (state.report.gender || '') + '</div></div>' +
                '<div class="infor-div"><div class="tags">Referred By:</div><div class="value" data-field="doctorName">' + (state.report.doctorName || '') + '</div></div>' +
                '<div class="infor-div"><div class="tags">Reg. no:</div><div class="value" data-field="bookingId">' + (state.report.bookingId || '') + '</div></div>' +
                '<div class="infor-div forhide"><div class="tags">Lab Name:</div><div class="value" data-field="labName">' + (state.report.labName || '') + '</div></div>' +
                '<div class="infor-div forhide" id="investDiv"><div class="tags">Investigations:</div><div class="value">' + (state.report.uniquetestArray || '') + '</div></div>' +
            '</div>' +
            '<div class="right2"><div>' +
                '<div class="registered-div2"><div class="registeration-tag2">Registered on:</div>' +
                    '<div class="time-div">' + formatDateTime(safeDateISO(state.report.date) + 'T' + (state.report.time || '')) + '</div></div>' +
                '<div class="registered-div2 forhide"><div class="registeration-tag2">Collected on:</div>' +
                    '<div class="time-div">' + formatDateTime(state.report.collectedOn) + '</div></div>' +
                '<div class="registered-div2 forhide"><div class="registeration-tag2">Received on:</div>' +
                    '<div class="time-div">' + formatDateTime(state.report.receivedOn) + '</div></div>' +
                '<div class="registered-div2"><div class="registeration-tag2">Reported on:</div>' +
                    '<div class="time-div">' + formatDateTime(state.report.reportedOn) + '</div></div>' +
            '</div></div>' +
            '<div class="barcode-div2"><div class="barcode2"><div id="barcodeContainer2">' +
                '<img id="barcodeImage" alt="Generated Barcode" />' +
            '</div></div></div>';

        $('.report-details').appendChild(details);
    }

    /* ========================= BARCODE ========================= */
    async function barcodegenerator() {
        let number = null;
        try {
            const booking = JSON.parse(localStorage.getItem('booking'));
            number = booking && booking.acceptedbarcode && booking.acceptedbarcode[0]
                ? booking.acceptedbarcode[0] : (booking && booking.bookingId);
        } catch (e) { /* no booking in storage */ }
        if (!number) number = state.report.bookingId;

        try {
            const response = await fetch(BASE_URL + '/api/v1/user/generate-barcode?nonumber=false', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number })
            });
            if (!response.ok) throw new Error('barcode http ' + response.status);
            const data = await response.json();
            const img = document.getElementById('barcodeImage');
            if (img) img.src = data.barcode;
        } catch (error) {
            console.error('Barcode generation failed:', error);
            toast('Barcode could not be generated.', 'warn');
        }
    }

    /* ========================= SIGNATURE FOOTER (.signed-off-div) =========================
       Markup is a snapshot contract — Puppeteer renders this as the PDF footer. */
    function injectSignatures(doctorsdata) {
        const signoffdiv = $('.signed-off-div');
        if (!signoffdiv || !doctorsdata) return;
        signoffdiv.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'signed-off-div2';
        div.innerHTML =
            '<div class="left-sign signdivstyleclass" style="display:' + (doctorsdata.showlabinchargesign ? 'block' : 'none') + ';">' +
                '<img src="' + (doctorsdata.labinchargesign || '') + '" width="90" height="32" /><br>' +
                '<div class="textspan">' + (doctorsdata.labinchargeinfo || '') + '</div></div>' +
            '<div class="left-sign signdivstyleclass" style="display:' + (doctorsdata.showfirstdoctorsign ? 'block' : 'none') + ';">' +
                '<img src="' + (doctorsdata.firstdoctorsign || '') + '" width="90" height="32" /><br>' +
                '<div class="textspan">' + (doctorsdata.firstdoctorsigninfo || '') + '</div></div>' +
            '<div class="click qr-div format3qrdiv">' +
                '<img id="qrimg" src="https://res.cloudinary.com/dmlfjbpb5/image/upload/v1730987604/vximbk8olbhmhmhp5ele.jpg" width="100" height="100"></div>' +
            '<div class="right-sign signdivstyleclass" style="display:' + (doctorsdata.showseconddoctorsign ? 'block' : 'none') + ';">' +
                '<img src="' + (doctorsdata.seconddoctorsign || '') + '" width="90" height="32" /><br>' +
                '<div class="textspan">' + (doctorsdata.seconddoctorsigninfo || '') + '</div></div>';
        signoffdiv.appendChild(div);

        /* Repaginate once signature images finish loading (height changes). */
        $$('img', signoffdiv).forEach((img) => {
            img.addEventListener('load', scheduleRepaginate, { once: true });
        });
    }

    async function qrcodegenerator() {
        try {
            const response = await fetch('/api/v1/user/generate-qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ link: urlWithParam })
            });
            if (!response.ok) throw new Error('QR http ' + response.status);
            const data = await response.json();
            const qr = document.getElementById('qrimg');
            if (!qr || !data || !data.qrCode) throw new Error('QR image was not returned');
            qr.src = data.qrCode;
            qr.style.display = 'block';
            state.qrCodeReady = true;
        } catch (error) {
            state.qrCodeReady = false;
            console.warn('QR generation skipped:', error.message);
        }
    }

    async function ensureQrCodeReady() {
        let qr = document.getElementById('qrimg');
        if (!state.qrCodeReady || !qr || !String(qr.getAttribute('src') || '').trim()) {
            await qrcodegenerator();
        }

        qr = document.getElementById('qrimg');
        const src = qr && String(qr.getAttribute('src') || '').trim();
        if (!state.qrCodeReady || !src || src.includes('vximbk8olbhmhmhp5ele.jpg')) {
            throw new Error('QR code is not ready. Report data was not saved.');
        }

        await convertImagesToBase64('#qrimg');
        return qr;
    }

    /* ========================= IMAGE -> BASE64 (PDF export parity) ========================= */
    async function imageToBase64(url) {
        const safeUrl = String(url || '').trim();
        if (!safeUrl || safeUrl.startsWith('data:') || safeUrl.startsWith('blob:')) return safeUrl;

        const response = await fetch(safeUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to fetch image: ' + response.status);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    }

    async function convertImagesToBase64(selector) {
        const images = $$(selector || '.signed-off-div2 img');
        await Promise.all(images.map(async (img) => {
            const src = String(img.getAttribute('src') || '').trim();
            if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
            try { img.src = await imageToBase64(src); }
            catch (error) { console.warn('base64 conversion skipped:', src, error); }
        }));
    }

    /* ========================= H/L FLAG EVALUATION (shared by render + live edits) ========================= */
    function evaluateFlags(test) {
        let isBold = false;
        let suffix = '';
        if (test && test.reference && test.value !== undefined && test.value !== '') {
            const parts = String(test.reference).split(' - ');
            if (parts.length === 2) {
                const lower = parseFloat(parts[0]);
                const upper = parseFloat(parts[1]);
                const value = parseFloat(test.value);
                if (!isNaN(lower) && !isNaN(upper) && !isNaN(value)) {
                    if (value < lower) { isBold = true; suffix = 'L'; }
                    else if (value > upper) { isBold = true; suffix = 'H'; }
                }
            }
        }
        if (typeof test.value === 'string' && test.value.toLowerCase().includes('positive')) isBold = true;
        return { isBold, suffix };
    }

    /* ========================= REPORT BODY RENDERER =========================
       Builds canonical children (sections / moreDetails / end note) exactly with
       the legacy class structure, plus data-bind hooks for editable cells. */
    function buildTestRow(test) {
        const row = document.createElement('tr');
        const flags = evaluateFlags(test);
        if (flags.isBold) { row.style.fontWeight = 'bold'; row.classList.add('BoldRow'); }

        if (test.isDocumented) {
            row.innerHTML =
                '<td class="wrong"><span class="delete-row-icon" title="Delete Row"><i class="fa-sharp fa-solid fa-xmark"></i></span></td>' +
                '<td colspan="4" style="padding:0;border:none;"><div class="documented-content">' + (test.testName || '') + '</div></td>';
            return row;
        }

        row.innerHTML =
            '<td class="wrong"><span class="delete-row-icon" title="Delete Row"><i class="fa-sharp fa-solid fa-xmark"></i></span></td>' +
            '<td class="test-name">' + (test.testName || '') + '</td>' +
            '<td class="high-low"><div class="HL"><span></span></div><span class="cell-edit" contenteditable="false" spellcheck="false" data-field="value"></span></td>' +
            '<td><span class="cell-edit" contenteditable="false" spellcheck="false" data-field="unit"></span></td>' +
            '<td><span class="cell-edit" contenteditable="false" spellcheck="false" data-field="reference"></span></td>';

        $('.HL span', row).textContent = flags.suffix;
        if (flags.suffix === 'H') $('.HL span', row).classList.add('flag-H');
        if (flags.suffix === 'L') $('.HL span', row).classList.add('flag-L');
        $('[data-field="value"]', row).textContent = test.value || '';
        $('[data-field="unit"]', row).textContent = test.unit || '';
        $('[data-field="reference"]', row).textContent = test.reference || '';
        return row;
    }

    function buildRemarkRow(test) {
        const row = document.createElement('tr');
        const empty = document.createElement('td');
        empty.className = 'wrong';
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.className = 'remark-row';
        cell.innerHTML = '<div>Remark:</div> <span class="cell-edit" contenteditable="false" spellcheck="false" data-field="remark"></span>';
        $('[data-field="remark"]', cell).textContent = test.remark || '';
        row.appendChild(empty);
        row.appendChild(cell);
        return row;
    }

    function buildDetailsRow(test) {
        const row = document.createElement('tr');
        const empty = document.createElement('td');
        empty.className = 'wrong';
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.className = 'details-row';
        cell.innerHTML = '<div class="documented-content">' + (test.details || '') + '</div>';
        row.appendChild(empty);
        row.appendChild(cell);
        return row;
    }

    /* Wire the delete icon of a test row to also remove its remark/details rows. */
    function wireRowDelete(testRow) {
        const icon = $('.delete-row-icon', testRow);
        if (!icon) return;
        icon.addEventListener('click', () => {
            const current = icon.closest('tr');
            let next = current.nextElementSibling;
            if (next && $('.remark-row', next)) { next.remove(); next = current.nextElementSibling; }
            if (next && $('.details-row', next)) next.remove();
            removeFromCanonical(current.closest('.section'));
            current.remove();
            onContentMutated();
        });
    }

    /* ========================= MAIN RENDER (canonical children) ========================= */
    function renderData(data) {
        const children = state.bodyChildren;

        (data.CategoryAndTest || []).forEach((categoryData, index) => {
            const section = document.createElement('div');
            section.className = 'section';
            if (data.categorizedPDF && index > 0) section.classList.add('page-break');

            /* --- headings --- */
            const headings = document.createElement('div');
            headings.className = 'headings';

            const deleteH2Button = document.createElement('span');
            deleteH2Button.innerHTML = '<i class="fa-sharp fa-solid fa-xmark" title="Delete Entire category section"></i>';
            deleteH2Button.className = 'delete-btn wrong';
            deleteH2Button.setAttribute('role', 'button');
            deleteH2Button.setAttribute('aria-label', 'Delete category section');

            const categoryHeading = document.createElement('h2');
            categoryHeading.textContent = categoryData.category;
            categoryHeading.appendChild(deleteH2Button);
            headings.appendChild(categoryHeading);

            let titleHeading = null;
            if (categoryData.category !== categoryData.title) {
                const deleteH3Button = document.createElement('span');
                deleteH3Button.innerHTML = '<i class="fa-sharp fa-solid fa-xmark" title="Delete Panel"></i>';
                deleteH3Button.className = 'delete-btn';
                deleteH3Button.setAttribute('role', 'button');
                deleteH3Button.setAttribute('aria-label', 'Delete panel');

                if (!String(categoryData.title).includes('Unknown Title')) {
                    titleHeading = document.createElement('h3');
                    titleHeading.textContent = categoryData.title;
                    titleHeading.appendChild(deleteH3Button);
                    headings.appendChild(titleHeading);
                }
                deleteH3Button.addEventListener('click', () => {
                    if (titleHeading) titleHeading.remove();
                    const parentTable = $('table', section);
                    if (parentTable) parentTable.remove();
                    removeFromCanonical(section);
                    onContentMutated();
                });
            }
            section.appendChild(headings);

            /* --- table --- */
            const table = document.createElement('table');
            table.className = 'test-table';
            table.innerHTML =
                '<thead><tr>' +
                '<th class="deletion"></th><th>Test Name</th>' +
                '<th class="valuecell">Value</th><th>Unit</th><th>Reference</th>' +
                '</tr></thead>';

            const tbody = document.createElement('tbody');

            (categoryData.tests || []).forEach((test) => {
                let testRow = null;

                if (test.testName) {
                    testRow = buildTestRow(test);
                    if (test.pagebreak) testRow.classList.add('page-break');
                    wireRowDelete(testRow);
                    tbody.appendChild(testRow);
                }
                if (test.remark) tbody.appendChild(buildRemarkRow(test));
                if (test.details) tbody.appendChild(buildDetailsRow(test));
            });

            /* --- table-level annotation rows (legacy structure kept) --- */
            const appendLabelRow = (label, className, html) => {
                const row = document.createElement('tr');
                const empty = document.createElement('td');
                empty.className = 'wrong';
                const cell = document.createElement('td');
                cell.colSpan = 4;
                cell.className = className;
                cell.innerHTML = '<div>' + label + ':</div> <span class="documented-content">' + html + '</span>';
                row.appendChild(empty);
                row.appendChild(cell);
                tbody.appendChild(row);
            };

            if (categoryData.advice) appendLabelRow('Advice', 'advice', categoryData.advice);
            if (categoryData.notes) appendLabelRow('Notes', 'notes', categoryData.notes);
            if (categoryData.remarks) appendLabelRow('Remarks', 'remarks', categoryData.remarks);

            if (categoryData.interpretation) {
                const row = document.createElement('tr');
                const empty = document.createElement('td');
                empty.className = 'wrong';
                const cell = document.createElement('td');
                cell.colSpan = 4;
                cell.innerHTML =
                    '<div class="interpretation"><p style="font-weight:bold;">Interpretation</p>' +
                    '<div class="documented-content">' + categoryData.interpretation + '</div></div>';
                row.appendChild(empty);
                row.appendChild(cell);
                tbody.appendChild(row);
            }

            table.appendChild(tbody);

            /* BUG#2: narrow screens horizontally scroll the table instead of
               truncating columns; PDF output unaffected (wrapper is a plain
               block div under legacy css). */
            const tableWrap = document.createElement('div');
            tableWrap.className = 'table-scroll';
            tableWrap.appendChild(table);
            section.appendChild(tableWrap);

            deleteH2Button.addEventListener('click', () => {
                removeFromCanonical(section);
                section.remove();
                onContentMutated();
            });

            children.push(section);
        });

        if (data.MoreDetails) {
            const more = document.createElement('div');
            more.className = 'moreDetails';
            more.innerHTML = '<span>Additional Findings :-</span><br><div class="documented-content">' + data.MoreDetails + '</div>';
            children.push(more);
        }
    }

    /* ========================================================================
        A4 SHEET LAYOUT ENGINE
        Builds simulated A4 pages. Page 1 header = letterhead + patient bar
        (.report-details). Every page footer = disclaimer + page indicator.
        Last page footer hosts the signature block (.signed-off-div).
        Canonical children are MOVED between page bodies for display only;
        snapshots re-collect them in document order (see buildCanonicalBody).
       ======================================================================== */
    const sheetStack = $('#sheetStackWrap');

    /* The loading page belongs to the preview canvas itself. Moving it here
       anchors it exactly where the generated A4 sheets will appear. */
    if (skeletonScreen && sheetStack) sheetStack.prepend(skeletonScreen);

    /* Canonical registry helpers — deleted sections leave the registry so
       repagination never resurrects them. */
    function removeFromCanonical(el) {
        const i = state.bodyChildren.indexOf(el);
        if (i > -1) state.bodyChildren.splice(i, 1);
    }

    function makeSheetHead(first) {
        const head = document.createElement('div');
        head.className = 'sheet-head' + (first ? '' : ' sheet-head--cont');

          /* Keep the template behind the page content, matching PDF compositing. */
        if (state.backgroundImageUrl) {
            const tpl = document.createElement('img');
            tpl.className = 'tpl-img';
            tpl.alt = '';
            tpl.src = state.backgroundImageUrl;
            head.appendChild(tpl);
        }

        if (first) {
            /* Hidden reg-id holder kept for populateHeader compatibility;
               visible Reg no. already lives inside the metadata bar below. */
            const regHolder = document.createElement('span');
            regHolder.id = 'booking-registeration-number';
            regHolder.className = 'sr-only';
            head.appendChild(regHolder);

            const details = document.createElement('div');
            details.className = 'report-details';
            /* Legacy snapshot parity: Puppeteer headerTemplate receives this
               node's outerHTML — keep the exact inline style the old page had. */
            details.setAttribute('style',
                'width: 100%; display: flex; justify-content: center;align-items: center;');
            head.appendChild(details);
        } else if (desktopMQ.matches || state.mode === 'continuous') {
            /* Continuation pages repeat the patient bar, mirroring the PDF's
               repeating headerTemplate. Clone strips ids/editability so the
               canonical node stays unique for snapshots. */
            const canon = $('.report-details');
            if (canon && canon.firstChild) {
                const clone = canon.cloneNode(true);
                clone.classList.add('is-clone');
                $$('[id]', clone).forEach((n) => n.removeAttribute('id'));
                $$('[contenteditable]', clone).forEach((n) => n.setAttribute('contenteditable', 'false'));
                clone.removeAttribute('style');
                clone.setAttribute('style',
                    'width: 100%; display: flex; justify-content: center;align-items: center;');
                head.appendChild(clone);
            }
        }
        return head;
    }

    function makeSheetFoot() {
        const foot = document.createElement('div');
        foot.className = 'sheet-foot';
        foot.innerHTML =
            '<div class="sheet-meta-row">' +
            '<span class="page-indicator"></span>' +
            '<span>Generated by OccuHealth LIS</span>' +
            '</div>' +
            '<p class="foot-disclaimer">This report is electronically generated and is valid only with the digital signature of the authorized signatory. Results should be correlated clinically.</p>';
        return foot;
    }

    function createSheet(first) {
        const sheet = document.createElement('article');
        sheet.className = 'sheet-page';
        sheet.setAttribute('aria-label', 'Report page');
        sheet.appendChild(makeSheetHead(first));
        const body = document.createElement('div');
        body.className = 'sheet-body';
        sheet.appendChild(body);
        sheet.appendChild(makeSheetFoot());

        /* Every sheet gets a footer signature slot; only the canonical one
           (filled by injectSignatures) survives pagination dedupe. */
        const signHost = document.createElement('div');
        signHost.className = 'signed-off-div';
        $('.sheet-foot', sheet).prepend(signHost);

        sheetStack.appendChild(sheet);
        state.sheets.push(sheet);
        return sheet;
    }

    /* The signature footer is a single canonical node. It can live on the
       last sheet, so never use the first .signed-off-div as the source. */
    function getSignatureHost() {
        return $$('.signed-off-div').find((host) => host.querySelector('.signed-off-div2')) ||
            $('.signed-off-div');
    }

    /* Screen-only end-of-report marker (single reusable node) */
    function getEndNote() {
        if (!state._endNote) {
            const d = document.createElement('div');
            d.className = 'end-report';
            d.textContent = '~~~~End report~~~~';
            state._endNote = d;
        }
        return state._endNote;
    }

    function paginate() {
        if (state.mode !== 'paginated' || !desktopMQ.matches) return;

        /* Preserve the populated footer before its previous last sheet is
           removed. Image-load repagination used to delete this node, which
           made both the preview and the saved PDF lose all signatures/QR. */
        const signBlock = getSignatureHost();
        if (signBlock && signBlock.parentNode) signBlock.parentNode.removeChild(signBlock);

        /* Remove every sheet except the first; rebuild from canonical children */
        state.sheets.slice(1).forEach((s) => s.remove());
        const firstSheet = state.sheets[0];
        if (!firstSheet) return;
        state.sheets = [firstSheet];
        let body = $('.sheet-body', firstSheet);
        body.innerHTML = '';

        const children = state.bodyChildren.filter(Boolean);

        /* BUG#2 guard: measure against a reduced capacity so rounding/fonts
           never push content past the clip edge. */
        const CAPACITY_BUFFER = 12;
        children.forEach((child) => {
            body.appendChild(child);
            if (body.scrollHeight > body.clientHeight - CAPACITY_BUFFER && body.children.length > 1) {
                body.removeChild(child);                 /* move to next page   */
                const next = createSheet(false);         /* continuation page   */
                body = $('.sheet-body', next);
                body.appendChild(child);
            }
        });

        /* End-of-report marker (screen-only; excluded from snapshots, exactly
           like the legacy page which kept it outside .container2). */
        const lastBody = $('.sheet-body', state.sheets[state.sheets.length - 1]);
        lastBody.appendChild(getEndNote());

        /* Canonical signature block lives ONLY in the last sheet footer */
        if (signBlock) {
            $$('.sheet-foot .signed-off-div').forEach((el) => { if (el !== signBlock) el.remove(); });
            let lastFoot = $('.sheet-foot', state.sheets[state.sheets.length - 1]);
            lastFoot.prepend(signBlock);
            lastFoot.classList.add('sheet-foot--sigs');

            /* Footer signatures consume real page height. Reflow the final
               content block until the fixed A4 page can contain both. */
            let lastPage = state.sheets[state.sheets.length - 1];
            let lastPageBody = $('.sheet-body', lastPage);
            const hasMultipleContentBlocks = () => Array.from(lastPageBody.children)
                .some((child, index, children) =>
                    child !== getEndNote() && children.some((other) => other !== getEndNote() && other !== child));
            while (lastPageBody.scrollHeight > lastPageBody.clientHeight + 1 &&
                hasMultipleContentBlocks()) {
                const endNote = getEndNote();
                const movable = Array.from(lastPageBody.children)
                    .reverse().find((child) => child !== endNote);
                if (!movable) break;
                movable.remove();
                const next = createSheet(false);
                lastPageBody = $('.sheet-body', next);
                lastPage = next;
                lastPageBody.appendChild(movable);
                lastFoot = $('.sheet-foot', lastPage);
                lastFoot.prepend(signBlock);
                lastFoot.classList.add('sheet-foot--sigs');
                lastPageBody.appendChild(endNote);
            }
        }

        /* A single section can be taller than one A4 body (for example a
           large documented table). It cannot be moved without changing the
           report's canonical markup, so let only that page grow safely. */
        state.sheets.forEach((sheet) => {
            const pageBody = $('.sheet-body', sheet);
            const hasSingleOversizedChild = pageBody && pageBody.children.length === 1 &&
                pageBody.scrollHeight > pageBody.clientHeight + 1;
            sheet.classList.toggle('sheet-auto', hasSingleOversizedChild);
        });

        updatePageIndicators();
    }

    function updatePageIndicators() {
        const total = Math.max(state.sheets.length, 1);
        state.sheets.forEach((sheet, i) => {
            const el = $('.page-indicator', sheet);
            if (el) el.textContent = 'Page ' + (i + 1) + ' of ' + total;
        });
    }

    /* Continuous mode (mobile / tablet): single seamless scrolling preview */
    function enterContinuousMode() {
        state.mode = 'continuous';
        document.body.classList.remove('mode-paginated');
        const first = state.sheets[0];
        if (!first) return;
        const target = $('.sheet-body', first);

        /* Capture the CANONICAL signature block (the one holding .signed-off-div2)
           BEFORE tearing down continuation sheets — it lives in the LAST page's
           footer and would otherwise be destroyed with them. */
        const hostsBefore = $$('.signed-off-div');
        const canonicalSig = getSignatureHost();

        /* Rescue body content from continuation pages BEFORE destroying them */
        state.sheets.slice(1).forEach((s) => {
            Array.from($('.sheet-body', s).children).forEach((c) => target.appendChild(c));
            s.remove();
        });
        state.sheets = state.sheets.slice(0, 1);

        /* Re-home the canonical signatures into the single remaining footer */
        $$('.signed-off-div').forEach((el) => { if (el !== canonicalSig) el.remove(); });
        if (canonicalSig) {
            const foot = $('.sheet-foot', first);
            foot.prepend(canonicalSig);
            foot.classList.add('sheet-foot--sigs');
        }
        target.appendChild(getEndNote());

        updatePageIndicators();
    }

    function enterPaginatedMode() {
        state.mode = 'paginated';
        document.body.classList.add('mode-paginated');
        paginate();
    }

    const scheduleRepaginate = debounce(() => {
        if (state.mode === 'paginated' && desktopMQ.matches) paginate();
    }, 220);

    /* Called after any DOM mutation that changes report content */
    function onContentMutated() {
        document.body.classList.add('is-dirty');
        scheduleRepaginate();
    }

    desktopMQ.addEventListener('change', () => {
        if (desktopMQ.matches) enterPaginatedMode();
        else enterContinuousMode();
    });

    /* ========================================================================
        SNAPSHOT PIPELINE (legacy contract — keys & shapes unchanged)
       ======================================================================== */
    function countLines() {
        const header = $('.report-details');
        if (!header) return 0;

        /* Measure header height in a strictly isolated A4 desktop sandbox (794px width)
           so measurements are 100% device-agnostic regardless of mobile/tablet screen size. */
        const sandbox = document.createElement('div');
        sandbox.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:794px;visibility:hidden;pointer-events:none;box-sizing:border-box;background:#fff;';

        const clone = header.cloneNode(true);
        const liveBarcode = $('#barcodeImage', header);
        const cloneBarcode = $('#barcodeImage', clone);
        if (liveBarcode && cloneBarcode && liveBarcode.src) {
            cloneBarcode.src = liveBarcode.src;
        }

        sandbox.appendChild(clone);
        document.body.appendChild(sandbox);
        const measuredHeight = clone.offsetHeight || header.offsetHeight || 0;
        document.body.removeChild(sandbox);
        return measuredHeight;
    }

    /* Rebuild a standalone .container2 holding every canonical child in order.
       This is what the Puppeteer generator receives as `htmlContent`. */
    function buildCanonicalBody() {
        const canonical = document.createElement('div');
        canonical.className = 'container2';
        state.bodyChildren.forEach((child) => {
            if (child && child.isConnected) canonical.appendChild(child.cloneNode(true));
        });
        return canonical;
    }

    function getPdfDataSnapshot(options) {
        const opts = options || {};
        const htmlContent = buildCanonicalBody().outerHTML;
        const cssContent = document.getElementById('stying').innerHTML;
        const header = $('.report-details').outerHTML;
        const footerEl = getSignatureHost();
        const footer = opts.footerOverride ?? (footerEl ? footerEl.outerHTML : '');
        const investigationmargin = countLines() + (opts.investigationOffset || 0);

        return { htmlContent, cssContent, header, footer, investigationmargin };
    }

    function getSignOffPdfSnapshot() {
        const snapshot = getPdfDataSnapshot();
        const footerRoot = document.createElement('div');
        const headerRoot = document.createElement('div');
        footerRoot.innerHTML = snapshot.footer;
        headerRoot.innerHTML = snapshot.header;

        const qr = footerRoot.querySelector('#qrimg');
        const qrSrc = qr && String(qr.getAttribute('src') || '').trim();
        const qrWrapper = qr && qr.closest('.qr-div');
        if (!qr || !qrSrc || qrSrc.includes('vximbk8olbhmhmhp5ele.jpg')) {
            throw new Error('QR code is missing from the PDF data. Report was not saved.');
        }
        if (qrWrapper) {
            qrWrapper.classList.remove('sign');
            qrWrapper.style.display = 'block';
        }

        const barcode = headerRoot.querySelector('#barcodeImage');
        const barcodeSrc = barcode && String(barcode.getAttribute('src') || '').trim();
        if (!barcode || !barcodeSrc) {
            throw new Error('Barcode is missing from the PDF data. Report was not saved.');
        }

        snapshot.footer = footerRoot.innerHTML;
        snapshot.header = headerRoot.innerHTML;
        return snapshot;
    }

    function buildPdfDataPayload(snapshot, extraFields) {
        return Object.assign({
            labinchargesign: state.report.showLabIncharge,
            reportId: state.reportId,
            bookingId: state.report.bookingId,
            backgroundImageUrl: state.backgroundImageUrl
        }, snapshot, extraFields || {});
    }

    async function savePdfData(payload) {
        const response = await fetch(BASE_URL + '/api/v1/user/adding-pdf-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(details || 'Data not saved (' + response.status + ')');
        }
        return response;
    }

    function savePdfDataFromPage(snapshot, extraFields) {
        return savePdfData(buildPdfDataPayload(snapshot, extraFields));
    }

    async function updatebookingisreportreadyfield(bookingid) {
        try {
            const response = await fetch(BASE_URL + '/api/v1/user/CompleteBookingcontroller', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingid })
            });
            if (!response.ok) console.warn('Booking status not updated');
        } catch (error) {
            console.warn('Booking status update failed:', error);
        }
    }

    /* ========================================================================
        EDITABLE CELLS — data-extraction layer
        Each .cell-edit carries data-field; rows are matched back to
        state.report.CategoryAndTest[ci].tests[ti] via row index tracking,
        then H/L flags re-evaluate live. Snapshots/PDF pick up edited text.
       ======================================================================== */
    function bindEditableCells() {
        const toggleBtn = document.getElementById('editModeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => setEditMode(!state.editing));
        }

        document.body.addEventListener('input', (event) => {
            const cell = event.target.closest && event.target.closest('.cell-edit[data-field]');
            if (!cell || !document.body.classList.contains('editing')) return;
            const row = cell.closest('tr');
            const test = testForRow(row);
            if (!test) return;

            const field = cell.getAttribute('data-field');
            const value = cell.textContent.trim();
            test[field] = value;

            if (field === 'value' || field === 'reference') {
                const flags = evaluateFlags(test);
                const flagEl = $('.HL span', row);
                if (flagEl) {
                    flagEl.textContent = flags.suffix;
                    flagEl.classList.remove('flag-H', 'flag-L');
                    if (flags.suffix === 'H') flagEl.classList.add('flag-H');
                    if (flags.suffix === 'L') flagEl.classList.add('flag-L');
                }
                row.classList.toggle('BoldRow', flags.isBold);
                row.style.fontWeight = flags.isBold ? 'bold' : '';
            }
            onContentMutated();
        });

        /* Plain-text only editing */
        document.body.addEventListener('paste', (event) => {
            const cell = event.target.closest && event.target.closest('.cell-edit');
            if (!cell) return;
            event.preventDefault();
            const text = (event.clipboardData || window.clipboardData).getData('text');
            document.execCommand('insertText', false, text);
        });

        document.body.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.target.closest && event.target.closest('.cell-edit')) {
                event.preventDefault();
                event.target.blur();
            }
        });
    }

    /* Map a <tr> rendered from buildTestRow/buildRemarkRow back to its test object */
    function testForRow(row) {
        if (!row) return null;
        const table = row.closest('table');
        const section = table && table.closest('.section');
        if (!section) return null;
        const ci = state.bodyChildren.indexOf(section);
        const category = state.report &&
            state.report.CategoryAndTest && state.report.CategoryAndTest[ci];
        if (!category) return null;
        const rowIndex = Array.prototype.indexOf.call($('tbody', table).children, row);

        /* Walk tests with their rendered row footprint to find owner */
        let cursor = 0;
        for (const test of (category.tests || [])) {
            const span = (test.testName ? 1 : 0) + (test.remark ? 1 : 0) + (test.details ? 1 : 0);
            if (rowIndex >= cursor && rowIndex < cursor + span) return test;
            cursor += span;
        }
        return null;
    }

    function setEditMode(enabled) {
        state.editing = enabled;
        document.body.classList.toggle('editing', enabled);
        $$('.cell-edit').forEach((el) => el.setAttribute('contenteditable', enabled ? 'true' : 'false'));
        const btn = document.getElementById('editModeToggle');
        if (btn) {
            btn.setAttribute('aria-pressed', String(enabled));
            const label = $('span', btn);
            if (label) label.textContent = enabled ? 'Editing' : 'Edit';
        }
        toast(enabled ? 'Editable cells enabled — click a value to type.' : 'Editing locked.', enabled ? undefined : undefined);
    }

    function setupEnterResult() {
        const button = document.getElementById('enterResult');
        if (!button) return;

        button.addEventListener('click', async () => {
            if (!state.report) return;

            const bookingId = state.report.bookingId || state.report.reg_id || state.report.booking_id;
            if (!bookingId) {
                toast('Booking ID not found for this report.', 'error');
                return;
            }

            try {
                button.disabled = true;
                const response = await fetch(`${BASE_URL}/api/v1/user/getbooking`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value1: bookingId })
                });

                if (response.ok) {
                    const booking = await response.json();
                    if (booking && (booking.bookingId || booking._id)) {
                        booking.__fullBooking = true;
                        localStorage.setItem('booking', JSON.stringify(booking));
                        localStorage.setItem('regId', JSON.stringify(booking.bookingId || bookingId));
                        window.open(`${BASE_URL}/admin/admin.html?page=labreport`, '_blank');
                        return;
                    }
                }

                // Fallback to state.report if getbooking API response is not valid
                localStorage.setItem('booking', JSON.stringify(state.report));
                localStorage.setItem('regId', JSON.stringify(bookingId));
                window.open(`${BASE_URL}/admin/admin.html?page=labreport`, '_blank');
            } catch (error) {
                console.error('Error fetching booking details for Enter Result:', error);
                localStorage.setItem('booking', JSON.stringify(state.report));
                localStorage.setItem('regId', JSON.stringify(bookingId));
                window.open(`${BASE_URL}/admin/admin.html?page=labreport`, '_blank');
            } finally {
                button.disabled = false;
            }
        });
    }

    /* ========================================================================
        SIGN-OFF FLOW (+ status pill + Enter-key shortcut)
       ======================================================================== */
    function setSignOffUI(signed) {
        const pill = document.getElementById('reportStatusPill');
        const text = document.getElementById('reportStatusText');
        if (!pill || !text) return;
        pill.classList.toggle('is-signed', Boolean(signed));
        text.textContent = signed ? 'Signed off' : 'Pending sign-off';
    }

    function setupSignOff() {
        const initialSigned = Boolean(state.report && state.report.signOff);
        if (initialSigned) {
            /* Legacy behaviour: a pre-signed report unlocks the gated buttons */
            $$('.click').forEach((button) => button.classList.remove('sign'));
        }
        setSignOffUI(initialSigned);

        document.getElementById('signOff').addEventListener('click', async function (e) {
            const downloadDiv = e.target.closest('.downloadDiv');
            const loader = downloadDiv && downloadDiv.querySelector('.loading-overlay');
            if (!loader) { console.error('Loading overlay not found'); return; }

            loader.style.display = 'flex';

            const targetButtons = $$('.click');

            try {
                await ensureQrCodeReady();

                /* Save the complete report snapshot before changing sign-off
                   state so other portals never receive a blank report. */
                await savePdfDataFromPage(getSignOffPdfSnapshot());

                /* Optimistically toggle the gated-button class after the
                   report data is persisted; revert it if sign-off fails. */
                targetButtons.forEach((button) => button.classList.toggle('sign'));
                const anyButtonHasSign = targetButtons.some((b) => b.classList.contains('sign'));
                const signoff = !anyButtonHasSign;

                const response = await fetch(BASE_URL + '/api/v1/user/editReportsignofffield', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value1: state.reportId, signoff })
                });
                if (!response.ok) throw new Error('signoff field not updated');

                setSignOffUI(signoff);
                if (state.report) state.report.signOff = signoff;
                toast(signoff ? 'Report signed off successfully.' : 'Sign-off removed.', 'success');

                /* Fire-and-forget: mark the booking report-ready in the
                   background so the UI stays responsive. The server-side
                   status transition + notification pipeline runs
                   independently and must never block sign-off. */
                if (state.report && state.report.bookingId) {
                    updatebookingisreportreadyfield(state.report.bookingId)
                        .catch((error) => console.warn('Background booking status update failed:', error));
                }
            } catch (error) {
                console.error('Sign-off flag update failed:', error);
                toast('Sign-off could not be saved. Please try again.', 'error');
                /* Revert the optimistic UI toggle */
                targetButtons.forEach((button) => button.classList.toggle('sign'));
            } finally {
                loader.style.display = 'none';
            }
        });
    }

    /* Enter key (outside inputs/buttons) triggers Sign off — legacy parity */
    function setupReportFormatKeyboardFlow() {
        const signOffButton = document.getElementById('signOff');
        if (!signOffButton) return;

        const isTypingField = (element) => {
            if (!element) return false;
            const tag = String(element.tagName || '').toUpperCase();
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
        };

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.repeat) return;
            const active = document.activeElement;
            if (isTypingField(active)) return;
            const tag = String(active && active.tagName || '').toUpperCase();
            if (tag === 'BUTTON' || tag === 'A') return;
            event.preventDefault();
            signOffButton.focus();
            signOffButton.click();
        });
    }

    /* Tenant-driven visibility tweaks (guarded — legacy crashed on null id) */
    function hidecontent() {
        if (typeof user === 'undefined' || !user) return;
        if (user.showprintsetting === false) {
            const btn = document.getElementById('PDFsettinganchr');
            if (btn) btn.style.display = 'none';
        }
        if (user.tenantId && user.tenantId.modelType === '1layer') {
            const style = document.getElementById('stying');
            style.textContent += '@media print { .barcode-div2 { top: 6%; } }';
            $$('.forhide').forEach((elem) => { elem.style.display = 'none'; });
        }
    }

    /* ========================================================================
        PDF GENERATION & PRINT SETTINGS
       ======================================================================== */
    async function downloadpdffunction(options) {
        const o = options || {};
        document.getElementById('downloadPDF').addEventListener('click', async (e) => {
            if (requestState.download) return;
            requestState.download = true;
            const wrapper = e.target.closest('.downloadDiv');
            const loader = wrapper && wrapper.querySelector('.loading-overlay');
            if (!loader) { console.error('Loading overlay not found'); return; }

            loader.style.display = 'flex';

            let snapshot;
            try {
                snapshot = getPdfDataSnapshot();
                await savePdfDataFromPage(snapshot);
            } catch (error) {
                console.error('Error generating PDF:', error);
                toast(error.message || 'Data save failed. PDF generation stopped.', 'error');
                loader.style.display = 'none';
                return;
            }

            try {
                const response = await fetch(BASE_URL + '/api/v1/user/get-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        value1: state.reportId,
                        investigationmargin: snapshot ? snapshot.investigationmargin : countLines(),
                        labinchargesign: o.labinchargesign || null,
                        checkBox: o.checkBox || false,
                        backgroundImageUrl: state.backgroundImageUrl,
                        headermargin: o.headermargin, footermargin: o.footermargin,
                        marginRight: o.marginRight, marginLeft: o.marginLeft,
                        labinchargeinfo: state.signInfo.labinchargeinfo,
                        labinchargesignurl: state.signInfo.sign,
                        selectedFontSize: o.selectedFontSize, RowSpacing: o.RowSpacing,
                        HighLow: o.HighLow, HLinred: o.HLinred, BoldRow: o.BoldRow,
                        showInvest: o.showInvest, DownloadPdf: true
                    })
                });
                if (!response.ok) throw new Error('PDF generation failed');

                const pdfBlob = await response.blob();
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(pdfBlob);
                link.download = getFormattedPdfFileName(state.report);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                await updatebookingisreportreadyfield(state.report.bookingId);
                toast('PDF downloaded.');
            } catch (error) {
                console.error('Error generating PDF:', error);
                toast('PDF generation failed. Please try again.', 'error');
            } finally {
                loader.style.display = 'none';
                requestState.download = false;
            }
        });
    }

    function setupPrintSettingsNavigation() {
        document.getElementById('PDFsettinganchr').addEventListener('click', async (event) => {
            event.preventDefault();
            const snapshot = getPdfDataSnapshot({ investigationOffset: 20 });
            try {
                await savePdfDataFromPage(snapshot);
                window.location.href = document.getElementById('PDFsettinganchr').href;
            } catch (error) {
                console.error('Error generating PDF:', error);
                toast('Could not open print settings — save failed.', 'error');
            }
        });
    }

    /* ========================================================================
        SEND / SHARE REPORT
       ======================================================================== */
    async function sendReport() {
        const popupModal = document.getElementById('popupModal');
        const closeButton = document.querySelector('.close-button');
        const inputField = document.getElementById('inputField');
        const contactInput = document.getElementById('contactInput');
        const sendButton = document.getElementById('sendButton');
        const iframe = document.getElementById('pdfFrame');

        const smsButton = document.getElementById('smsButton');
        const whatsappButton = document.getElementById('whatsappButton');
        const emailButton = document.getElementById('emailButton');
        const openPdfButton = document.getElementById('openPdfButton');

        document.getElementById('sendReport').addEventListener('click', async (e) => {
            if (requestState.send) return;
            requestState.send = true;
            const wrapper = e.target.closest('.downloadDiv');
            const loader = wrapper && wrapper.querySelector('.loading-overlay');
            if (!loader) { console.error('Loading overlay not found'); return; }

            loader.style.display = 'flex';

            try {
                await savePdfDataFromPage(getPdfDataSnapshot({
                    footerOverride: getSignatureHost().outerHTML,
                    investigationOffset: 20
                }));
            } catch (error) {
                console.error('Error generating PDF:', error);
                toast(error.message || 'Data save failed. PDF generation stopped.', 'error');
                loader.style.display = 'none';
                return;
            }

            try {
                const response = await fetch(BASE_URL + '/api/v1/user/get-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value1: state.reportId })
                });
                if (!response.ok) throw new Error('PDF generation failed');

                if (popupModal.style.display === 'block') return;
                popupModal.style.display = 'block';
                loader.style.display = 'none';

                const pdfBlob = await response.blob();
                iframe.src = URL.createObjectURL(pdfBlob);
            } catch (error) {
                toast('Error generating PDF. Please try again.', 'error');
                popupModal.style.display = 'none';
                loader.style.display = 'none';
            } finally {
                requestState.send = false;
            }
        });

        closeButton.addEventListener('click', () => { popupModal.style.display = 'none'; });

        window.addEventListener('click', (event) => {
            if (event.target === popupModal) popupModal.style.display = 'none';
        });

        const setupInputField = (placeholderText, actionCallback) => {
            inputField.style.display = 'flex';
            contactInput.value = '';
            contactInput.placeholder = placeholderText;
            sendButton.onclick = null;
            sendButton.onclick = () => {
                const contact = contactInput.value.trim();
                if (!contact) return toast('Please enter a valid input!', 'warn');
                actionCallback(contact, iframe.src);
            };
        };

        smsButton.addEventListener('click', () => setupInputField('Enter Phone Number for SMS', sendSMS));
        whatsappButton.addEventListener('click', () => setupInputField('Enter WhatsApp Number', sendWhatsApp));
        emailButton.addEventListener('click', () => setupInputField('Enter Email Address', sendEmail));

        openPdfButton.addEventListener('click', () => {
            if (!iframe || !iframe.src) return;
            const pdfFileName = getFormattedPdfFileName(state.report);

            const downloadLink = document.createElement('a');
            downloadLink.href = iframe.src;
            downloadLink.download = pdfFileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            const pdfWindow = window.open('', '_blank');
            if (pdfWindow) {
                const displayTitle = ((state.report && state.report.patientName) || 'Patient Report').trim();
                pdfWindow.document.write(
                    '<!DOCTYPE html><html><head><title>' + displayTitle + ' - Test Report</title>' +
                    '<style>html,body{margin:0;padding:0;height:100%;width:100%;overflow:hidden;background:#525659;}</style></head>' +
                    '<body><iframe src="' + iframe.src + '" width="100%" height="100%" style="border:none;"></iframe></body></html>'
                );
                pdfWindow.document.close();
            }
        });
    }

    /* ========================= SHARE TRANSPORTS ========================= */
    async function sendSMS(phoneNumber, pdfUrl) {
        try {
            const pdfResponse = await fetch(pdfUrl);
            if (!pdfResponse.ok) throw new Error('PDF download failed');
            const pdfFile = new File([await pdfResponse.blob()], 'report2.pdf', { type: 'application/pdf' });
            const formData = new FormData();
            formData.append('pdf', pdfFile);
            formData.append('phoneNumber', phoneNumber);
            formData.append('message', 'This is your test report from OccuHealth. Thank you for using our services!');
            const response = await fetch(BASE_URL + '/api/v1/user/send-sms', { method: 'POST', body: formData });
            if (response.ok) toast('SMS sent successfully!');
            else toast('Failed to send SMS. Please try again.', 'error');
        } catch (error) {
            console.error('Error sending SMS:', error);
            toast('An error occurred while sending the SMS.', 'error');
        }
    }

    function sendWhatsApp(whatsappNumber) {
        if (!whatsappNumber || !/^\d+$/.test(whatsappNumber)) {
            toast('Please enter a valid WhatsApp number without spaces or special characters.', 'warn');
            return;
        }
        const message = encodeURIComponent(
            'Your Lab test report from OccuHealth Click on the link below to download the report\n ' + urlWithParam
        );
        window.open('https://wa.me/' + whatsappNumber + '?text=' + message, '_blank');
    }

    async function sendEmail(email) {
        try {
            if (!iframe || !iframe.src) throw new Error('PDF is not ready');
            const pdfResponse = await fetch(iframe.src);
            if (!pdfResponse.ok) throw new Error('PDF download failed');
            const formData = new FormData();
            formData.append('pdf', new File([await pdfResponse.blob()], 'report.pdf', { type: 'application/pdf' }));
            formData.append('email', email);
            formData.append('subject', 'Your Test Report from OccuHealth');
            formData.append('body', 'This is your test report from OccuHealth. Thank you for using our services!');
            const response = await fetch(BASE_URL + '/api/v1/user/send-email', { method: 'POST', body: formData });
            if (response.ok) toast('Email sent successfully!');
            else toast('Failed to send Email. Please try again.', 'error');
        } catch (error) {
            console.error('Error sending Email:', error);
            toast('An error occurred while sending the Email.', 'error');
        }
    }

    /* ========================================================================
        BROWSER PRINT — LEGACY-EXACT OUTPUT (PDF/print parity)
        Rebuilds the old continuous container shell and prints it with ONLY
        the legacy stylesheet (#stying) + the original print-window overrides,
        exactly like the pre-redesign page did.
       ======================================================================== */
    function setupBrowserPrint() {
        document.getElementById('BrowserPrint').addEventListener('click', function () {
            const reportStyles = document.getElementById('stying').textContent;
            const regNo = (document.getElementById('booking-registeration-number') || {}).textContent || '';
            const headerHtml = $('.report-details') ? $('.report-details').outerHTML : '';
            const bodyHtml = buildCanonicalBody().outerHTML;
            const signatureHost = getSignatureHost();
            const footHtml = signatureHost ? signatureHost.outerHTML : '';
            const printWindow = window.open('', '_blank');

            if (!printWindow) {
                toast('Please allow pop-ups to print the report.', 'warn');
                return;
            }

            printWindow.document.open();
            printWindow.document.write(`
            <!doctype html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Print Report</title>
                <style>
                    ${reportStyles}
                    @page { margin: 0; }
                    html, body {
                        width: 100%;
                        margin: 0;
                        padding: 0;
                        overflow-x: hidden;
                    }
                    body { background: #fff; }
                    .container {
                        width: 100% !important;
                        box-sizing: border-box;
                        padding: 0 !important;
                        box-shadow: none;
                        margin: 0 auto;
                        overflow: visible;
                    }
                    .container22 {
                        width: 100% !important;
                        min-width: 0 !important;
                        box-sizing: border-box;
                        padding: 0 12px !important;
                        margin: 0 auto;
                    }
                    .report-details,
                    .container2,
                    .table-div,
                    .signed-off-div {
                        width: 100% !important;
                        max-width: 100% !important;
                        box-sizing: border-box;
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                    .report-details-innerDiv2 {
                        width: 100% !important;
                        box-sizing: border-box;
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                    table { width: 100% !important; }
                    .download-pdf-div, #modal, #popupModal,
                    .app-toolbar, .action-dock, #skeletonScreen,
                    #toastStack, .no-print { display: none !important; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="container22">
                        <div class="header">
                            <h1>Lab Report</h1>
                            <span class="badge">booking Id. <span id="booking-registeration-number">${regNo}</span></span>
                        </div>
                        ${headerHtml}
                        <div class="container2">
                            <div class="table-div">${bodyHtml}</div>
                        </div>
                        <br><br>
                        <hr>
                        <h3>~~~~End report~~~~</h3>
                    </div>
                    ${footHtml}
                </div>
            </body>
            </html>`);
            printWindow.document.close();

            printWindow.addEventListener('load', () => {
                printWindow.print();
                printWindow.close();
            }, { once: true });
        });
    }

    /* ========================================================================
        BOOT SEQUENCE
       ======================================================================== */
    async function boot() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const value1 = urlParams.get('value1');
            if (!value1) throw new Error('No report reference supplied (?value1=).');

            /* 1 · Data */
            let report = await fetchreport(value1);
            if (!report || !report._id) throw new Error('Report data is unavailable.');
            state.report = report;
            state.reportId = report._id;
            const [backgroundImageUrl, doctorsData] = await Promise.all([
                fetchTemplateImages(),
                fetchDoctorsSign(),
            ]);
            state.backgroundImageUrl = backgroundImageUrl;
            setupSession(state.reportId);

            state.doctorsData = doctorsData;
            const { labinchargeinfo, sign } = await fetchLabSignAndSetInputs();
            state.signInfo = { labinchargeinfo, sign };

            /* 2 · Layout scaffold (mode BEFORE first sheet so A4 metrics apply) */
            state.mode = desktopMQ.matches ? 'paginated' : 'continuous';
            if (state.mode === 'paginated') document.body.classList.add('mode-paginated');
            createSheet(true);

            populateHeader();
            await barcodegenerator();
            injectSignatures(state.doctorsData);
            renderData(report);

            /* Mount canonical children into the flowing first page */
            const firstBody = $('.sheet-body', state.sheets[0]);
            state.bodyChildren.forEach((child) => firstBody.appendChild(child));

            /* 3 · Rich assets then pagination */
            await qrcodegenerator();
            await convertImagesToBase64('.signed-off-div2 img');
            if (state.mode === 'paginated') paginate(); else updatePageIndicators();

            /* 4 · Chrome & actions */
            const subtitle = document.getElementById('toolbarSubtitle');
            if (subtitle && report.patientName) {
                subtitle.textContent = report.patientName +
                    (report.bookingId ? ' · Reg ' + report.bookingId : '');
            }
            document.title = ((report.patientName || 'Patient') + ' — Lab Report').trim();

            bindEditableCells();
            setupEnterResult();
            setupSignOff();
            await downloadpdffunction();
            await sendReport();
            setupBrowserPrint();
            setupPrintSettingsNavigation();
            setupReportFormatKeyboardFlow();
            hidecontent();

            /* 5 · Reveal (zero CLS: geometry reserved by skeleton) */
            hideSkeleton();
            const dock = $('.download-pdf-div');
            if (dock) dock.classList.add('is-ready');
        } catch (error) {
            console.error('Boot failed:', error);
            showFatalError(error && error.message ? error.message : 'Unable to load the report.');
        }
    }

    boot();
})();