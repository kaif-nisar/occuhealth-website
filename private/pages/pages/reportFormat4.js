(async function () {
    const bootStartedAt = Date.now();
    const MIN_SKELETON_VISIBLE_MS = 150;
    const bootLoaderEl    = document.getElementById('pageBootLoader');
    const bootShellEl     = bootLoaderEl?.querySelector('.page-boot-shell');
    const pageRootEl      = document.getElementById('reportFormat4Root') || document.body;
    const reportContainerEl = document.getElementById('container');
    const signOffEl       = document.querySelector('.signed-off-div');
    const actionBarEl     = document.querySelector('.download-pdf-div');

    function syncBootLoaderLayout() {
        const container = document.getElementById('container');
        if (!bootLoaderEl || !bootShellEl || !container || !pageRootEl) return;
        const rootRect  = pageRootEl.getBoundingClientRect();
        const rect      = container.getBoundingClientRect();
        const topOffset = Math.max(0, Math.round(rect.top - rootRect.top));
        bootLoaderEl.style.paddingTop = `${topOffset}px`;
        bootLoaderEl.style.height     = `${Math.max(pageRootEl.clientHeight, window.innerHeight)}px`;
        bootShellEl.style.width       = `${Math.round(rect.width)}px`;
    }

    function setPageVisible(v) {
        const vis = v ? 'visible' : 'hidden';
        if (reportContainerEl) reportContainerEl.style.visibility = vis;
        if (signOffEl)         signOffEl.style.visibility         = vis;
        if (actionBarEl)       actionBarEl.style.visibility       = vis;
        if (pageRootEl)        pageRootEl.style.overflow          = v ? '' : 'hidden';
    }

    setPageVisible(false);
    if (bootLoaderEl) { bootLoaderEl.style.display = 'flex'; bootLoaderEl.classList.remove('is-hiding'); }
    syncBootLoaderLayout();
    window.addEventListener('resize', syncBootLoaderLayout);

    async function waitForVisualReady() {
        const imgs = document.querySelectorAll('#qrimg, #qrimgright, #barcodeImage');
        await Promise.all(Array.from(imgs).map(img => new Promise(resolve => {
            if (!img || !img.src || (img.complete && img.naturalWidth > 0)) return resolve();
            const done = () => resolve();
            const t = setTimeout(done, 1200);
            img.addEventListener('load',  () => { clearTimeout(t); done(); }, { once: true });
            img.addEventListener('error', () => { clearTimeout(t); done(); }, { once: true });
        })));
        if (document.fonts?.ready) {
            try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 350))]); } catch {}
        }
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }

    function markPageReady() {
        const elapsed = Date.now() - bootStartedAt;
        const wait    = Math.max(0, MIN_SKELETON_VISIBLE_MS - elapsed);
        setTimeout(() => {
            setPageVisible(true);
            const bl = document.getElementById('pageBootLoader');
            if (bl) { bl.classList.add('is-hiding'); setTimeout(() => { bl.style.display = 'none'; }, 240); }
            window.removeEventListener('resize', syncBootLoaderLayout);
        }, wait);
    }

    function markPageFailed(err) {
        console.error('Report bootstrap failed:', err);
        const bl = document.getElementById('pageBootLoader');
        if (bl) { const lbl = bl.querySelector('.page-boot-text'); if (lbl) lbl.textContent = 'Failed to load report'; }
        setTimeout(() => markPageReady(), 1200);
    }

    try {
        // ── 1. URL params ──
        const urlParams = new URLSearchParams(window.location.search);
        let value1 = urlParams.get('value1');

        // ── 2. Fetch report ──
        const report = await fetchreport();
        value1 = report._id;

        const baseUrl = `${BASE_URL}/pages/pages/download_reports.html`;
        let backgroundImageUrl = null;
        const templateImagePromise = fetchTemplateImages()
            .then(url => { backgroundImageUrl = url || null; return backgroundImageUrl; })
            .catch(() => null);

        localStorage.setItem('myKey',      value1);
        localStorage.setItem('bookingId',  report.bookingId);
        localStorage.setItem('pdfformat',  user.pdfFormat);

        const urlWithParam = `${baseUrl}?value=${encodeURIComponent(value1)}&id=${encodeURIComponent(user.tenantId._id)}`;

        let reportformatlabsign          = false;
        let reportformatfirstdoctorsign  = false;
        let reportformatseconddoctorsign = false;
        let prewarmInFlight        = false;
        let prefetchedViewBlobUrl  = null;
        let prefetchedPayloadKey   = "";
        let doctorsSignCache       = null;
        let renderTask             = Promise.resolve();
        let qrTask                 = Promise.resolve();
        let barcodeTask            = Promise.resolve();

        // ── 3. Bootstrap ──
        const doctorsSignTask = fetchdoctorsandlabsign();
        await populateHeader();

        barcodeTask = barcodegenerator();
        renderTask  = renderData(report);
        syncBootLoaderLayout();
        signoffdivfunction();
        downloadpdffunction();
        sendReport();
        hidecontent();
        markPageReady();

        const defer = cb => {
            if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => cb(), { timeout: 1200 });
            else setTimeout(cb, 0);
        };

        defer(() => {
            Promise.allSettled([doctorsSignTask, qrTask, barcodeTask, waitForVisualReady(), convertImagesToBase64('.signed-off-div2 img')])
                .then(() => prewarmPdfInBackground())
                .catch(() => prewarmPdfInBackground());
        });

        // ════════════════════════════════════════════════════════
        //  HELPERS
        // ════════════════════════════════════════════════════════

        async function fetchdoctorsandlabsign() {
            try {
                const res = await fetch(`${BASE_URL}/api/v1/user/getDoctorsSign`);
                if (!res.ok) { console.log("doctor sign not available"); return null; }
                const d = await res.json();
                doctorsSignCache             = d;
                reportformatlabsign          = d.showlabinchargesign;
                reportformatfirstdoctorsign  = d.showfirstdoctorsign;
                reportformatseconddoctorsign = d.showseconddoctorsign;

                const el = document.querySelector('.signed-off-div');
                el.innerHTML = '';
                const div = document.createElement('div');
                div.className = 'signed-off-div2';
                div.innerHTML = `
                <div class="left-sign" style="display:${d.showfirstdoctorsign?'block':'none'};">
                    <img src="${d.firstdoctorsign||''}" width="95" height="35" loading="eager" decoding="sync"><br>
                    <div class="textspan">${d.firstdoctorsigninfo}</div>
                </div>
                <div class="left-sign" style="display:${d.showlabinchargesign?'block':'none'};">
                    <img src="${d.labinchargesign||''}" width="95" height="35" loading="eager" decoding="sync"><br>
                    <div class="textspan">${d.labinchargeinfo}</div>
                </div>
                <div class="right-sign" style="display:${d.showseconddoctorsign?'block':'none'};">
                    <img src="${d.seconddoctorsign||''}" width="95" height="35" loading="eager" decoding="sync"><br>
                    <div class="textspan">${d.seconddoctorsigninfo}</div>
                </div>`;
                el.appendChild(div);
                return d;
            } catch (e) { console.log(e.message); return null; }
        }

        async function qrcodegenerator() {
            try {
                const res  = await fetch(`/api/v1/user/generate-qr`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link: urlWithParam }) });
                if (!res.ok) throw new Error('QR failed');
                const data = await res.json();
                const src  = data?.qrCode || data?.qrcode || data?.qr || data?.image || data?.url;
                if (!src) throw new Error('QR source missing');

                // Show QR on RIGHT side only (matching image — top right corner)
                const qrRight = document.getElementById('qrimgright');
                if (qrRight) {
                    qrRight.src = src.startsWith('data:') ? src : await urlToBase64(src).catch(() => src);
                    qrRight.style.display = 'block';
                }
            } catch (e) { console.error('QR Error:', e); }
        }

        async function urlToBase64(url) {
            const abs = new URL(url, window.location.origin).href;
            const same = new URL(abs).origin === window.location.origin;
            const res = await fetch(abs, { credentials: same ? 'include' : 'omit', mode: 'cors', cache: 'no-store' });
            if (!res.ok) throw new Error('fetch failed');
            const blob = await res.blob();
            return new Promise((resolve, reject) => {
                const r = new FileReader();
                r.readAsDataURL(blob);
                r.onload  = () => resolve(r.result);
                r.onerror = reject;
            });
        }

        async function convertImagesToBase64(selector) {
            const imgs = document.querySelectorAll(selector);
            if (!imgs.length) return;
            await Promise.all(Array.from(imgs).map(async img => {
                if (!img.src || img.src.startsWith('data:') || !img.src) return;
                try { img.src = await urlToBase64(img.src); } catch {}
            }));
        }

        async function ensureImagesBase64(sels = ['#qrimgright', '#barcodeImage', '.signed-off-div2 img']) {
            await Promise.all(sels.map(async sel => {
                const imgs = document.querySelectorAll(sel);
                await Promise.all(Array.from(imgs).map(async img => {
                    if (!img.src || img.src.startsWith('data:')) return;
                    try { img.src = await urlToBase64(img.src); }
                    catch { img.src = new URL(img.src, window.location.origin).href; }
                }));
            }));
        }

        async function ensureCriticalCodeAssetsReady() {
            const qrEl  = document.getElementById('qrimgright');
            const bcEl  = document.getElementById('barcodeImage');
            const hasQr = !!(qrEl?.src?.startsWith('data:image'));
            const hasBc = !!(bcEl?.src?.startsWith('data:image'));
            if (hasQr && hasBc) return;
            await Promise.allSettled([qrTask, barcodeTask]);
            const retry = [];
            if (qrEl && !qrEl.src)  { qrTask = qrcodegenerator();   retry.push(qrTask); }
            if (bcEl && !bcEl.src)  { barcodeTask = barcodegenerator(); retry.push(barcodeTask); }
            if (retry.length) await Promise.allSettled(retry);
            await Promise.all([qrEl, bcEl].map(img => waitForImageReady(img, 850)));
        }

        function waitForImageReady(img, ms = 6000) {
            if (!img || !img.src) return Promise.resolve();
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(resolve => {
                const done = () => resolve();
                const t = setTimeout(done, ms);
                img.addEventListener('load',  () => { clearTimeout(t); done(); }, { once: true });
                img.addEventListener('error', () => { clearTimeout(t); done(); }, { once: true });
            });
        }

        async function collectPdfPayload(extras = {}, opts = {}) {
            const { skipImagePrep = false } = opts;
            await renderTask;
            await ensureCriticalCodeAssetsReady();
            if (!skipImagePrep) { await ensureImagesBase64(); await waitForVisualReady(); }
            const bgUrl = backgroundImageUrl ?? await templateImagePromise.catch(() => null);
            return {
                showlab:            reportformatlabsign,
                showdoctorfirst:    reportformatfirstdoctorsign,
                showdoctorsecond:   reportformatseconddoctorsign,
                htmlContent:        document.querySelector('.container2').outerHTML,
                cssContent:         document.getElementById('stying').innerHTML,
                header:             document.querySelector('.report-details').outerHTML,
                footer:             document.querySelector('.signed-off-div').outerHTML,
                reportId:           value1,
                backgroundImageUrl: bgUrl,
                investigationmargin: countLines(),
                ...extras
            };
        }

        async function savePdfData(extras = {}) {
            const r = await fetch(`/api/v1/user/adding-pdf-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await collectPdfPayload(extras)) });
            if (!r.ok) throw new Error('data not saved');
        }

        const buildViewPayloadKey = p => JSON.stringify({ ...p, value1, DownloadPdf: false });
        const toViewPayload       = p => ({ ...p, backgroundImageUrl: null, checkBox: true, disableBackgroundImage: true });

        function setPrefetch(blob, key) {
            if (prefetchedViewBlobUrl) URL.revokeObjectURL(prefetchedViewBlobUrl);
            prefetchedViewBlobUrl = URL.createObjectURL(blob);
            prefetchedPayloadKey  = key;
        }

        async function fetchServerPdfBlob(payload) {
            const r = await fetch(`/api/v1/user/get-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, value1, DownloadPdf: false }) });
            if (!r.ok) throw new Error('PDF generation failed');
            return r.blob();
        }

        async function prewarmPdfInBackground() {
            if (prewarmInFlight) return;
            prewarmInFlight = true;
            try {
                const p   = await collectPdfPayload({}, { skipImagePrep: true });
                const vp  = toViewPayload(p);
                const key = buildViewPayloadKey(vp);
                if (prefetchedViewBlobUrl && key === prefetchedPayloadKey) return;
                const blob = await fetchServerPdfBlob(vp);
                setPrefetch(blob, key);
            } catch (e) { console.warn('PDF prewarm failed:', e); }
            finally { prewarmInFlight = false; }
        }

        document.getElementById('PDFsettinganchr').addEventListener('click', async e => {
            e.preventDefault();
            try { await savePdfData(); window.location.href = document.getElementById('PDFsettinganchr').href; }
            catch (e) { console.error(e); }
        });

        document.getElementById('viewPDF').addEventListener('click', async e => {
            const loader = e.target.closest('.downloadDiv').querySelector('#loadingOverlay');
            if (loader) loader.style.display = 'flex';
            e.target.disabled = true;
            const newTab = window.open('', '_blank');
            if (!newTab) { alert('Popup blocked!'); if (loader) loader.style.display = 'none'; e.target.disabled = false; return; }
            newTab.document.write(`<!DOCTYPE html><html><head><title>Opening PDF...</title><style>*{margin:0;padding:0}body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f0f4ff;font-family:Arial}.spinner{width:56px;height:56px;border:6px solid #c7d9ff;border-top:6px solid #1a73e8;border-radius:50%;animation:spin .85s linear infinite;margin-bottom:22px}@keyframes spin{to{transform:rotate(360deg)}}p{font-size:16px;color:#555}</style></head><body><div class="spinner"></div><p>Opening PDF...</p></body></html>`);
            newTab.document.close();
            try {
                if (prefetchedViewBlobUrl) { newTab.location.href = prefetchedViewBlobUrl; return; }
                const p    = await collectPdfPayload({}, { skipImagePrep: true });
                const vp   = toViewPayload(p);
                const key  = buildViewPayloadKey(vp);
                const blob = await fetchServerPdfBlob(vp);
                setPrefetch(blob, key);
                newTab.location.href = prefetchedViewBlobUrl;
            } catch (e) {
                console.error(e);
                newTab.document.open();
                newTab.document.write(`<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial;font-size:17px;color:red;">❌ PDF generation failed.</body></html>`);
                newTab.document.close();
            } finally { if (loader) loader.style.display = 'none'; e.target.disabled = false; }
        });

        window.addEventListener('beforeunload', () => {
            if (prefetchedViewBlobUrl) URL.revokeObjectURL(prefetchedViewBlobUrl);
            prefetchedViewBlobUrl = null; prefetchedPayloadKey = "";
        });

        async function sendReport() {
            const btn        = document.getElementById('sendReport');
            const modal      = document.getElementById('popupModal');
            const closeBtn   = document.querySelector('.close-button');
            const inputField = document.getElementById('inputField');
            const contactIn  = document.getElementById('contactInput');
            const sendBtn    = document.getElementById('sendButton');
            const iframe     = document.getElementById('pdfFrame');

            btn.addEventListener('click', async e => {
                const loader = e.target.closest('.downloadDiv').querySelector('#loadingOverlay');
                if (loader) loader.style.display = 'flex';
                e.target.disabled = true;
                try {
                    const p = await collectPdfPayload();
                    const r = await fetch(`/api/v1/user/get-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...p, value1 }) });
                    if (!r.ok) throw new Error('PDF failed');
                    modal.style.display = 'block';
                    iframe.src = URL.createObjectURL(await r.blob());
                } catch { alert('Error generating PDF.'); modal.style.display = 'none'; }
                finally { if (loader) loader.style.display = 'none'; e.target.disabled = false; }
            });

            closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
            window.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

            const setupInput = (placeholder, cb) => {
                inputField.style.display = 'flex';
                contactIn.value = ''; contactIn.placeholder = placeholder;
                sendBtn.onclick = () => { const v = contactIn.value.trim(); if (!v) return alert('Enter valid input!'); cb(v, iframe.src); };
            };

            document.getElementById('smsButton').addEventListener('click',       () => setupInput('Enter Phone Number', sendSMS));
            document.getElementById('whatsappButton').addEventListener('click',  () => setupInput('Enter WhatsApp Number', sendWhatsApp));
            document.getElementById('emailButton').addEventListener('click',     () => setupInput('Enter Email Address', sendEmail));
            document.getElementById('openPdfButton').addEventListener('click',   () => window.open(iframe.src, '_blank'));
        }

        async function sendSMS(phone, pdfUrl) {
            const blob = await (await fetch(pdfUrl)).blob();
            const fd   = new FormData();
            fd.append('pdf', new File([blob], 'report.pdf', { type: 'application/pdf' }));
            fd.append('phoneNumber', phone);
            fd.append('message', 'This is your test report from OccuHealth. Thank you!');
            try { const r = await fetch(`/api/v1/user/send-sms`, { method: 'POST', body: fd }); alert(r.ok ? 'SMS sent!' : 'SMS failed.'); }
            catch { alert('SMS error.'); }
        }

        async function sendWhatsApp(num) {
            if (!num || !/^\d+$/.test(num)) return alert("Enter valid WhatsApp number.");
            window.open(`https://wa.me/${num}?text=${encodeURIComponent(`Your Lab test report from OccuHealth\n${urlWithParam}`)}`, '_blank');
        }

        async function sendEmail(email) {
            try {
                const r = await fetch(`/api/v1/user/send-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, subject: 'Your Test Report from OccuHealth', body: 'Your test report from OccuHealth.', urlWithParam }) });
                alert(r.ok ? 'Email sent!' : 'Email failed.');
            } catch { alert('Email error.'); }
        }

        async function fetchreport() {
            try {
                const r = await fetch(`/api/v1/user/ReportData`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value1 }) });
                if (!r.ok) throw new Error('fetch failed');
                return await r.json();
            } catch (e) { console.log(e); }
        }

        function fmtDT(ts) {
            const d   = new Date(ts);
            const dd  = d.getDate().toString().padStart(2,'0');
            const mm  = (d.getMonth()+1).toString().padStart(2,'0');
            const yy  = d.getFullYear();
            let   hh  = d.getHours();
            const min = d.getMinutes().toString().padStart(2,'0');
            const ap  = hh >= 12 ? 'PM' : 'AM';
            hh = (hh % 12 || 12).toString().padStart(2,'0');
            return `${dd}-${mm}-${yy} ${hh}:${min} ${ap}`;
        }

        // ══════════════════════════════════════════════════════════
        //  populateHeader  –  exact match to images
        //  LEFT: patient name+details+qr(hidden initially)
        //  CENTER: barcode image + booking ID
        //  RIGHT: "Scan to download" text + QR box + 4 date rows
        // ══════════════════════════════════════════════════════════
        async function populateHeader() {
            const wrap = document.createElement('div');
            wrap.className = 'hdr-wrap';

            wrap.innerHTML = `
            <!-- LEFT -->
            <div class="hdr-left">
                <div class="hdr-pt-name">${report.patientName || ''}</div>
                <div class="hdr-pt-row"><span class="hdr-pt-label">Age / Sex</span><span class="hdr-pt-val">: ${report.year || ''} / ${report.gender || ''}</span></div>
                <div class="hdr-pt-row"><span class="hdr-pt-label">Referred by</span><span class="hdr-pt-val">: ${report.doctorName || ''}</span></div>
                <div class="hdr-pt-row"><span class="hdr-pt-label">Reg. no.</span><span class="hdr-pt-val">: ${report.bookingId || ''}</span></div>
                <div class="hdr-qr-row">
                    <img id="qrimg" src="" loading="eager" decoding="sync" style="display:none;">
                    <div class="hdr-powered">Powered By www.OccuHealth.in</div>
                </div>
            </div>

            <!-- CENTER -->
            <div class="hdr-mid">
                <img id="barcodeImage" alt="Barcode">
                <div class="hdr-barcode-id">${report.bookingId || ''}</div>
            </div>

            <!-- RIGHT -->
            <div class="hdr-right">
                <div class="hdr-qr-block">
                    <span class="hdr-scan-txt">Scan to download</span>
                    <img id="qrimgright" src="" loading="eager" decoding="sync">
                </div>
                <div class="hdr-dates">
                    <div class="hdr-date-row"><span class="hdr-dlabel">Registered on</span><span class="hdr-dval">: ${fmtDT(report.date || report.createdAt || Date.now())}</span></div>
                    <div class="hdr-date-row"><span class="hdr-dlabel">Collected on</span><span class="hdr-dval">: ${fmtDT(report.collectedOn || report.date || Date.now())}</span></div>
                    <div class="hdr-date-row"><span class="hdr-dlabel">Received on</span><span class="hdr-dval">: ${fmtDT(report.receivedOn || report.date || Date.now())}</span></div>
                    <div class="hdr-date-row"><span class="hdr-dlabel">Reported on</span><span class="hdr-dval">: ${fmtDT(report.reportedOn || report.date || Date.now())}</span></div>
                </div>
            </div>`;

            document.querySelector('.report-details').appendChild(wrap);

            // Start QR async
            qrTask = qrcodegenerator();
            qrTask.catch(e => console.warn('QR failed:', e));
        }

        async function barcodegenerator() {
            const booking = JSON.parse(localStorage.getItem('booking'));
            try {
                const r = await fetch(`/api/v1/user/generate-barcode?nonumber=true`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ number: booking.acceptedbarcode[0] || booking.bookingId, displayValue: false, background: 'transparent' })
                });
                if (r.ok) {
                    const d  = await r.json();
                    const bc = document.getElementById('barcodeImage');
                    bc.src   = d.barcode;
                    bc.style.background = 'transparent';
                } else { console.warn('Barcode failed'); }
            } catch (e) { console.error('Barcode error:', e); }
        }

        // ══════════════════════════════════════════════════════════
        //  renderData  –  builds sections exactly as in images
        // ══════════════════════════════════════════════════════════
        async function renderData(data) {
            const container = document.getElementById('tables-container');
            const frag      = document.createDocumentFragment();
            container.innerHTML = '';

            const categories = Array.isArray(data?.CategoryAndTest) ? data.CategoryAndTest : [];

            for (let i = 0; i < categories.length; i++) {
                const cat = categories[i];

                const secBox = document.createElement('div');
                secBox.className = 'sec-box';
                if (data.categorizedPDF && i > 0) secBox.classList.add('page-break');

                // ── Category heading ──
                const catDiv = document.createElement('div');
                catDiv.className = 'sec-cat';
                catDiv.textContent = cat.category;
                secBox.appendChild(catDiv);

                // ── Sub-title (only if different from category) ──
                if (cat.title && cat.category !== cat.title && !cat.title.includes('Unknown Title')) {
                    const subDiv = document.createElement('div');
                    subDiv.className = 'sec-sub';
                    subDiv.textContent = cat.title;
                    secBox.appendChild(subDiv);
                }

                // ── Determine rendering mode ──
                // If ALL tests are documented (isDocumented=true) OR none have a numeric value+unit+reference
                // → use paragraph/label style (like PBS section in image)
                // Otherwise → table style (like BIOCHEMISTRY in image)
                const tests           = cat.tests || [];
                const hasTableRows    = tests.some(t => t.testName && !t.isDocumented && (t.value !== undefined || t.unit || t.reference));
                const isDocumentedCat = !hasTableRows;

                if (isDocumentedCat) {
                    // ── PARAGRAPH STYLE ──
                    const docBody = document.createElement('div');
                    docBody.className = 'sec-doc';

                    tests.forEach(test => {
                        if (!test.testName && !test.isDocumented) return;

                        if (test.isDocumented) {
                            // Rich HTML content
                            const d = document.createElement('div');
                            d.innerHTML = test.testName || '';
                            d.style.marginBottom = '3px';
                            docBody.appendChild(d);
                        } else {
                            // "LABEL    :- VALUE" style row
                            const row = document.createElement('div');
                            row.className = 'doc-row';
                            const lbl = document.createElement('span');
                            lbl.className = 'doc-lbl';
                            lbl.textContent = test.testName;
                            const val = document.createElement('span');
                            val.className = 'doc-val';
                            val.textContent = test.value ? `:- ${test.value}` : '';
                            row.appendChild(lbl);
                            row.appendChild(val);
                            docBody.appendChild(row);
                        }

                        if (test.remark) {
                            const r = document.createElement('div');
                            r.style.cssText = 'font-size:11px;margin-left:148px;margin-bottom:3px;';
                            r.innerHTML = `<b>Remark:</b> ${test.remark}`;
                            docBody.appendChild(r);
                        }
                        if (test.details) {
                            const d = document.createElement('div');
                            d.style.cssText = 'font-size:11px;margin-bottom:3px;';
                            d.innerHTML = test.details;
                            docBody.appendChild(d);
                        }
                    });

                    secBox.appendChild(docBody);

                } else {
                    // ── TABLE STYLE ──
                    const table = document.createElement('table');
                    table.className = 'sec-tbl';
                    table.innerHTML = `<thead><tr>
                        <th>TEST</th>
                        <th>VALUE</th>
                        <th>UNIT</th>
                        <th>REFERENCE</th>
                    </tr></thead>`;

                    const tbody = document.createElement('tbody');

                    tests.forEach(test => {
                        if (!test.testName) return;

                        if (test.pagebreak) {
                            const pbRow = document.createElement('tr');
                            pbRow.className = 'page-break';
                            tbody.appendChild(pbRow);
                        }

                        if (test.isDocumented) {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `<td colspan="4" style="padding:0;border:none;">
                                <div class="sec-doc" style="border:none;">${test.testName}</div>
                            </td>`;
                            tbody.appendChild(tr);
                        } else {
                            // Check H / L
                            let abn   = Boolean(test.isBold || test.isAbnormal);
                            let hlTag = '';
                            if (!abn && test.reference) {
                                const pts = test.reference.split(' - ');
                                if (pts.length === 2) {
                                    const lo = parseFloat(pts[0]);
                                    const hi = parseFloat(pts[1]);
                                    const v  = parseFloat(test.value);
                                    if (!isNaN(lo) && !isNaN(hi) && !isNaN(v)) {
                                        if (v < lo) { abn = true; hlTag = 'L'; }
                                        else if (v > hi) { abn = true; hlTag = 'H'; }
                                    }
                                }
                            }
                            if (!abn && typeof test.value === 'string' && test.value.toLowerCase().includes('positive')) abn = true;

                            const tr = document.createElement('tr');
                            if (abn) tr.classList.add('row-abn');
                            tr.innerHTML = `
                                <td>${test.testName}</td>
                                <td style="text-align:center;${abn ? 'font-weight:700;' : ''}">${hlTag ? `<span class="hl-tag">${hlTag}</span>` : ''}${test.value || ''}</td>
                                <td>${test.unit || ''}</td>
                                <td>${test.reference || ''}</td>`;
                            tbody.appendChild(tr);
                        }

                        if (test.remark) {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `<td colspan="4" class="remark-cell"><b>Remark:</b> ${test.remark}</td>`;
                            tbody.appendChild(tr);
                        }
                        if (test.details) {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `<td colspan="4" style="font-size:11px;padding:3px 10px;">${test.details}</td>`;
                            tbody.appendChild(tr);
                        }
                    });

                    // advice / notes / remarks rows
                    ['advice', 'notes', 'remarks'].forEach(key => {
                        if (cat[key]) {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `<td colspan="4" style="font-size:11px;padding:4px 10px;"><b>${key.charAt(0).toUpperCase()+key.slice(1)}:</b> ${cat[key]}</td>`;
                            tbody.appendChild(tr);
                        }
                    });

                    table.appendChild(tbody);
                    secBox.appendChild(table);
                }

                // ── Interpretation ──
                if (cat.interpretation) {
                    const d = document.createElement('div');
                    d.className = 'sec-interp';
                    d.innerHTML = `<div class="sec-interp-title">Interpretation</div>${cat.interpretation}`;
                    secBox.appendChild(d);
                }

                // ── Note ──
                if (cat.note) {
                    const d = document.createElement('div');
                    d.className = 'sec-note';
                    d.innerHTML = `<div class="sec-note-title">Note:</div>${cat.note}`;
                    secBox.appendChild(d);
                }

                frag.appendChild(secBox);

                if ((i + 1) % 2 === 0) {
                    container.appendChild(frag);
                    await new Promise(r => requestAnimationFrame(r));
                }
            }

            if (frag.childNodes.length) container.appendChild(frag);

            if (data.MoreDetails) {
                const d = document.createElement('div');
                d.style.cssText = 'padding:6px 4px 10px;font-size:11px;';
                d.innerHTML = `<span>Additional Findings :-</span><br><div>${data.MoreDetails}</div>`;
                container.appendChild(d);
            }
        }

        async function fetchTemplateImages() {
            try {
                const r = await fetch(`/api/v1/user/templates`, { method: 'POST' });
                const d = await r.json();
                if (d.urls && Array.isArray(d.urls)) return d.urls[0].template;
            } catch (e) { console.error('Template fetch error:', e); }
        }

        function countLines() { return document.querySelector('.report-details').offsetHeight; }

        async function signoffdivfunction() {
            const signBtn   = document.getElementById('signOff');
            if (!signBtn) return;
            const isLayerOne = user?.tenantId?.modelType === '1layer';
            let isSignedOff  = Boolean(report.signOff);

            const syncUI = signed => {
                document.querySelectorAll('.click').forEach(b => b.classList.toggle('sign', !signed));
                if (signOffEl) signOffEl.classList.toggle('sign', !signed);
            };

            const persist = async signoff => {
                const upd = await collectPdfPayload({ bookingId: report.bookingId, isdocumented: report.isdocumented });
                try {
                    const d = doctorsSignCache || await fetch(`${BASE_URL}/api/v1/user/getDoctorsSign`).then(r => r.json());
                    doctorsSignCache = d;
                    if (signoff) Object.assign(upd, { showlab: d.showlabinchargesign, showdoctorfirst: d.showfirstdoctorsign, showdoctorsecond: d.showseconddoctorsign, fileInputLab: d.labinchargesign, fileInputDoctorleft: d.firstdoctorsign, fileInputDoctorright: d.seconddoctorsign, fileInputLabtext: d.labinchargeinfo, fileInputDoctorlefttext: d.firstdoctorsigninfo, fileInputDoctorrighttext: d.seconddoctorsigninfo });
                } catch (e) { console.log(e.message); }
                await Promise.all([
                    fetch(`/api/v1/user/editReportsignofffield`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value1, signoff }) }),
                    fetch(`/api/v1/user/adding-pdf-data`,        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(upd) })
                ]);
                isSignedOff = signoff; report.signOff = signoff;
                await updateBooking(report.bookingId);
                setTimeout(() => prewarmPdfInBackground(), 0);
            };

            if (isLayerOne) {
                const w = signBtn.closest('.downloadDiv');
                if (w) w.style.display = 'none';
                syncUI(true);
                if (!isSignedOff) persist(true).catch(e => console.error(e));
                return;
            }

            syncUI(isSignedOff);
            signBtn.addEventListener('click', async e => {
                const loader = e.target.closest('.downloadDiv').querySelector('#loadingOverlay');
                if (!loader) return;
                loader.style.display = 'flex'; e.target.disabled = true;
                const prev = isSignedOff;
                try { await persist(!prev); syncUI(!prev); }
                catch (e) { syncUI(prev); console.error(e); }
                finally { loader.style.display = 'none'; e.target.disabled = false; }
            });
        }

        async function updateBooking(bookingid) {
            try {
                const r = await fetch(`/api/v1/user/CompleteBookingcontroller`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingid }) });
                if (!r.ok) console.log('status not updated');
            } catch (e) { console.log(e); }
        }

        async function downloadpdffunction() {
            document.getElementById('downloadPDF').addEventListener('click', async e => {
                const loader = e.target.closest('.downloadDiv').querySelector('#loadingOverlay');
                if (!loader) return;
                loader.style.display = 'flex'; e.target.disabled = true;
                try {
                    const p = await collectPdfPayload();
                    const r = await fetch(`/api/v1/user/get-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...p, value1, DownloadPdf: true }) });
                    if (!r.ok) throw new Error('PDF failed');
                    const blob     = await r.blob();
                    const safeName = (report.patientName||'Patient').replace(/[^a-zA-Z0-9\u0900-\u097F\s]/g,'').trim().replace(/\s+/g,'_');
                    const safeId   = (report.bookingId||'').replace(/[^a-zA-Z0-9]/g,'');
                    const a        = document.createElement('a');
                    a.href         = URL.createObjectURL(blob);
                    a.download     = `${safeName}-${safeId}.pdf`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    await updateBooking(report.bookingId);
                } catch (e) { console.error(e); }
                finally { loader.style.display = 'none'; e.target.disabled = false; }
            });
        }

        document.getElementById('BrowserPrint').addEventListener('click', () => {
            const html = document.getElementById('container').innerHTML;
            const css  = document.getElementById('stying').innerHTML;
            const w    = window.open('', '_blank');
            w.document.open();
            w.document.write(`<html><head><title>Print</title><style>${css} body{font-family:Arial;margin:20px;}</style></head><body onload="window.print();window.close();">${html}</body></html>`);
            w.document.close();
        });

        function hidecontent() {
            if (user.showprintsetting === false) document.getElementById('printsettingbutton').style.display = 'none';
            if (user.tenantId.modelType === '1layer') {
                document.getElementById('stying').textContent += `
                #qrimgright { width:58px !important; height:48px !important; }
                @media print { #qrimgright { width:50px !important; height:42px !important; } .hdr-wrap { min-height:60px !important; } }`;
            }
        }

    } catch (error) { markPageFailed(error); }
})();
