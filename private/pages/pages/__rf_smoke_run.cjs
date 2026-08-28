/* Temporary ditto-PDF smoke runner (deleted after use). */
const { execSync } = require('child_process');
const path = require('path');
const PAGES = __dirname;

execSync('node "' + path.join(PAGES, '__rf_smoke_build.cjs') + '"', { stdio: 'inherit' });

const puppeteer = require(path.join('..', '..', '..', 'node_modules', 'puppeteer-core'));

(async () => {
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        headless: 'new',
        args: ['--no-sandbox', '--disable-gpu']
    });
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('PAGE-ERROR:', e.message));

    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto('file:///' + path.join(PAGES, '__rf_smoke.tmp.html').replace(/\\/g, '/') +
        '?value1=rep123', { waitUntil: 'load' });

    const A = await page.evaluate(() => window.__probe());       /* desktop   */
    const P = await page.evaluate(() => window.__probeParity()); /* parity    */

    await page.setViewport({ width: 430, height: 820 });         /* mobile    */
    await new Promise(r => setTimeout(r, 550));
    const B = await page.evaluate(() => window.__probe());

    await page.setViewport({ width: 1440, height: 1000 });       /* desktop   */
    await new Promise(r => setTimeout(r, 600));
    const C = await page.evaluate(() => window.__probe());

    const D = await page.evaluate(() => window.__probePayload());
    await browser.close();

    const noBleedA = A.hOverflowPx <= 1;
    const noBleedB = B.hOverflowPx <= 1;
    const dockOkA = A.dockLeft !== null && A.dockLeft >= 0 && A.dockRight <= A.vw + 1;
    const dockOkB = B.dockLeft !== null && B.dockLeft >= 0 && B.dockRight <= B.vw + 1;

    const checks = [
        ['A · boot complete + dock ready', A.skeletonGone && A.dockReady],
        ['A · paginated sheets >= 2 with indicators', A.sheets >= 2 && /^Page 1 of/.test(A.indicators[0] || '')],
        ['A · ZERO horizontal overflow (BUG#1)', noBleedA],
        ['A · action dock fully inside viewport', dockOkA],
        ['A · no clipped sheet bodies (BUG#2)', A.noClip === true],
        ['A · tables wrapped in scroll containers', A.hasTableScroll === true],
        ['A · template letterhead image rendered', A.tplOk === true && A.tplCount >= 1],
        ['A · invented branding removed (BUG#3)', A.inventedBrand === false],
        ['A · single canonical signature block', A.sigBlocks === 1 && A.sigHas2 && A.sigFootClass],
        ['P · .report-details height frozen', P.withOverlay === P.withoutOverlay],
        ['B · continuous mode on mobile', B.isPaginatedClass === false && B.sheets === 1],
        ['B · ZERO horizontal overflow on mobile', noBleedB],
        ['B · dock inside viewport on mobile', dockOkB],
        ['B · content preserved in rescue', B.testRows >= 60 && B.testRows === A.testRows],
        ['B · signatures + end-note preserved', B.sigBlocks === 1 && B.sigHas2],
        ['C · repaginated back on desktop', C.isPaginatedClass && C.sheets >= 2],
        ['C · everything intact after round-trip', C.testRows === A.testRows && C.sigBlocks === 1 && C.sigHas2 && C.noClip],
        ['D · payload keys complete', D.missingKeys.length === 0],
        ['D · cssContent is untouched LEGACY', D.cssIsLegacy && D.cssMatchesStying],
        ['D · header/footer markup legacy-exact', D.headerInlineOk && D.footerOk],
        ['D · investigationmargin numeric', D.marginIsNumber === true]
    ];

    let pass = 0;
    for (const [name, ok] of checks) {
        console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
        if (!ok) console.log('      -> ' + JSON.stringify({ A, P, B, C, D }).slice(0, 900));
        if (ok) pass++;
    }
    console.log('\nheight parity:', JSON.stringify(P),
        '| overflow px desktop/mobile:', A.hOverflowPx, '/', B.hOverflowPx,
        '| dock:', A.dockLeft, '-', A.dockRight, 'vw', A.vw);
    console.log(pass + '/' + checks.length + ' DITTO-PDF checks passed');
    process.exit(pass === checks.length ? 0 : 1);
})().catch((e) => { console.error('RUNNER-ERROR:', e); process.exit(2); });
