/* One-shot: swap #ohScreen content with the new ditto-PDF design layer. */
const fs = require('fs');
const path = require('path');

const PAGES = __dirname;
const htmlPath = path.join(PAGES, 'reportFormat.html');
const cssPath = path.join(PAGES, '__oh.css');

let html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8').replace(/\r\n/g, '\n');

const openTag = '<style id="ohScreen">';
const oi = html.indexOf(openTag);
if (oi < 0) { console.error('FATAL: #ohScreen not found'); process.exit(1); }
const ci = html.indexOf('</style>', oi);
if (ci < 0) { console.error('FATAL: ohScreen closer not found'); process.exit(1); }

html = html.slice(0, oi + openTag.length) + '\n' + css + html.slice(ci);

fs.writeFileSync(htmlPath, html);
console.log('OHSCREEN SWAPPED ✔  new css chars:', css.length);

/* quick structural sanity */
const s = html.indexOf('<style id="stying">');
const o = html.indexOf('<style id="ohScreen">');
console.log('order ok:', s > -1 && o > s, '| stying has legacy blue:', /#1a73e8/.test(html.slice(s, o)));
