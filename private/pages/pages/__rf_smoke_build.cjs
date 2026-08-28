/* Temporary ditto-PDF smoke builder (deleted after use). */
const fs = require('fs');
const path = require('path');

const PAGES = __dirname;
let html = fs.readFileSync(path.join(PAGES, 'reportFormat.html'), 'utf8');
const js = fs.readFileSync(path.join(PAGES, 'reportFormat.js'), 'utf8');

function mkTests(seed, n) {
    const tests = [];
    for (let i = 1; i <= n; i++) {
        const v = (seed * i) % 23;
        tests.push({
            testName: 'Analyte ' + seed + '.' + i,
            value: String(v), unit: 'g/dL', reference: '8.0 - 18.0',
            remark: v < 8 ? 'Low' : '',
            details: i === 3 ? '<div class="documented-content"><p>Method notes.</p></div>' : ''
        });
    }
    return tests;
}

/* Tiny 1x1 png used as the lab letterhead template image */
const TPL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const REPORT = {
    _id: 'rep123', reg_id: 'REG-777', bookingId: 'BK-001',
    patientName: 'Zaid', year: '34', gender: 'Male',
    doctorName: 'Dr. House', labName: 'TDS Health Diagnostics',
    uniquetestArray: 'CBC, LFT',
    date: '2026-08-20T00:00:00Z', time: '09:30',
    collectedOn: '2026-08-20T01:00:00Z',
    receivedOn: '2026-08-20T02:00:00Z',
    reportedOn: '2026-08-21T05:00:00Z',
    showLabIncharge: true, signOff: false, categorizedPDF: true,
    CategoryAndTest: [
        { category: 'Haematology', title: 'Complete Blood Count', tests: mkTests(1, 30),
          advice: '<p>Stay hydrated.</p>', notes: '<p>Fasting not required.</p>',
          interpretation: '<p>Within expected limits.</p>' },
        { category: 'Biochemistry', title: 'Liver Function', tests: mkTests(2, 30),
          remarks: '<p>Mild variation acceptable.</p>' }
    ],
    MoreDetails: '<div class="documented-content"><p>Additional findings none.</p></div>'
};

const DOCTORS = {
    showlabinchargesign: true, labinchargesign: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    labinchargeinfo: 'Dr. Lab Incharge',
    showfirstdoctorsign: true, firstdoctorsign: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    firstdoctorsigninfo: 'Dr. First Pathologist',
    showseconddoctorsign: true, seconddoctorsign: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    seconddoctorsigninfo: 'Dr. Second Pathologist'
};

/* @@STUB-NEXT@@ */

const STUB = `
<script>
window.__lastPdfPayload = null;
window.BASE_URL = 'http://mock.local';
window.user = { pdfFormat: 'reportFormat', showprintsetting: true,
                tenantId: { _id: 'tenant1', modelType: '2layer' } };
const R = (body) => Promise.resolve({ ok: true, status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    blob: () => Promise.resolve(new Blob(['%PDF-mock'], { type: 'application/pdf' })) });
window.fetch = function (url, opts) {
    url = String(url);
    if (url.includes('/ReportData')) return R(${JSON.stringify(REPORT)});
    if (url.includes('/templates')) return R({ urls: [{ template: '${TPL}' }] });
    if (url.includes('getDoctorsSign')) return R(${JSON.stringify(DOCTORS)});
    if (url.includes('generate-barcode')) return R({ barcode: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' });
    if (url.includes('generate-qr')) return R({ qrCode: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' });
    if (url.includes('adding-pdf-data')) {
        try { window.__lastPdfPayload = JSON.parse(opts.body); } catch (e) {}
        return R({ success: true });
    }
    if (url.includes('get-pdf')) return R({ pdf: true });
    if (url.includes('editReportsignofffield')) return R({ success: true });
    if (url.includes('CompleteBookingcontroller')) return R({ success: true });
    return R({});
};
</script>`;

const PROBE_SNIPPET = `
<script>
window.__probe = async function () {
    await new Promise(r => setTimeout(r, 550));
    const q = s => document.querySelector(s);
    const qa = s => Array.from(document.querySelectorAll(s));
    const de = document.documentElement;
    const dock = q('.download-pdf-div');
    const dr = dock ? dock.getBoundingClientRect() : null;
    /* Visible-text brand scan: strip script/style so the probe's own
       source can't self-match. */
    const cleanBody = document.body.cloneNode(true);
    cleanBody.querySelectorAll('script,style').forEach((s) => s.remove());
    const visibleText = cleanBody.textContent || '';
    const bodiesOverflow = [];
    let noClip = true;
    qa('.sheet-body').forEach((b) => {
        const sheet = b.closest('.sheet-page');
        if (!(sheet && sheet.classList.contains('sheet-auto')) &&
            b.scrollHeight > b.clientHeight + 1) {
            noClip = false;
            bodiesOverflow.push({ s: b.scrollHeight, c: b.clientHeight });
        }
    });
    const tpl = q('.sheet-head .tpl-img');
    return {
        skeletonGone: !document.getElementById('skeletonScreen'),
        dockReady: dock && dock.classList.contains('is-ready'),
        isPaginatedClass: document.body.classList.contains('mode-paginated'),
        sheets: qa('.sheet-page').length,
        testRows: qa('.test-table tbody tr').length,
        sigBlocks: qa('.signed-off-div').length,
        sigHas2: !!q('.signed-off-div .signed-off-div2'),
        sigFootClass: !!q('.sheet-foot--sigs'),
        indicators: qa('.page-indicator').map(e => e.textContent),
        hOverflowPx: de.scrollWidth - window.innerWidth,
        vw: window.innerWidth,
        dockLeft: dr ? Math.round(dr.left) : null,
        dockRight: dr ? Math.round(dr.right) : null,
        tplOk: !!tpl && (tpl.getAttribute('src') || '').startsWith('data:image/png'),
        tplCount: qa('.tpl-img').length,
        hasTableScroll: !!q('.table-scroll'),
        noClip,
        bodiesOverflow,
        inventedBrand: visibleText.includes('OccuHealth Diagnostics') ||
                       visibleText.includes('SKU Health')
    };
};
/* PDF-PARITY: .report-details height must be identical with and without
   #ohScreen — investigationmargin feeds Puppeteer's top margin. */
window.__probeParity = async function () {
    const el = document.querySelector('.report-details');
    const ohs = document.getElementById('ohScreen');
    await new Promise(r => setTimeout(r, 200));
    const withOverlay = el.offsetHeight;
    ohs.disabled = true;
    void el.offsetWidth;
    const withoutOverlay = el.offsetHeight;
    ohs.disabled = false;
    void el.offsetWidth;
    return { withOverlay, withoutOverlay };
};
window.__probePayload = async function () {
    document.getElementById('downloadPDF').click();
    await new Promise(r => setTimeout(r, 600));
    const p = window.__lastPdfPayload || {};
    return {
        missingKeys: ['htmlContent','cssContent','header','footer',
            'investigationmargin','reportId','bookingId'].filter(k => p[k] === undefined),
        cssIsLegacy: (p.cssContent || '').includes('#1a73e8') &&
                     !(p.cssContent || '').includes('--oh-primary'),
        cssMatchesStying: p.cssContent === document.getElementById('stying').innerHTML,
        headerInlineOk: (p.header || '').startsWith(
            '<div class="report-details" style="width: 100%; display: flex; justify-content: center;align-items: center;">'),
        footerOk: (p.footer || '').includes('signed-off-div2') &&
                  (p.footer || '').includes('Dr. Lab Incharge'),
        marginIsNumber: typeof p.investigationmargin === 'number'
    };
};
</script>
</body>`;

/* Function replacers — immune to `$&` patterns inside the inlined JS */
html = html.replace('</body>', () => PROBE_SNIPPET);
html = html.replace('<script src="reportFormat.js"></script>',
    () => STUB + '\n<script>\n' + js + '\n</script>');

fs.writeFileSync(path.join(PAGES, '__rf_smoke.tmp.html'), html);
console.log('SMOKE HARNESS WRITTEN');
