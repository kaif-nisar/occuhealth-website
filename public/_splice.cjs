const fs = require('fs');

const mainPath = 'public/index.html';
const appendPath = 'public/_append.html';

let main = fs.readFileSync(mainPath, 'utf8');
const appendContent = fs.readFileSync(appendPath, 'utf8');

// Find the truncated Instagram anchor in index.html (where the file was cut off)
const marker = '<a href="https://www.instagram.com/occuhealth5/"';
const cutIdx = main.lastIndexOf(marker);

if (cutIdx === -1) {
    console.error('ERROR: Instagram anchor marker not found in index.html');
    process.exit(1);
}

const head = main.slice(0, cutIdx);
const result = head + appendContent;

fs.writeFileSync(mainPath, result);

console.log('SPLICED OK');
console.log('main length before:', main.length);
console.log('final length:', result.length);
console.log('ends with </html>:', result.trimEnd().endsWith('</html>'));
console.log('has demoModal:', result.indexOf('id="demoModal"') !== -1);
console.log('has FAQ script:', result.indexOf('.faq-toggle') !== -1);
console.log('has pricing toggle:', result.indexOf('billingToggle') !== -1);
console.log('has close of footer:', result.indexOf('</footer>') !== -1);
console.log('has close body/html:', result.indexOf('</body>') !== -1 && result.trimEnd().endsWith('</html>'));