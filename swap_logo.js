const fs = require('fs');
const file = 'public/index.html';
let s = fs.readFileSync(file, 'utf8');
const lines = s.split('\n');
const hasCR = s.includes('\r\n');

const blocks = [
  { start: 650, end: 655 },   // header nav brand clock-icon span
  { start: 699, end: 704 },   // mobile drawer brand clock-icon span
  { start: 2598, end: 2603 }  // footer brand clock-icon span
];

const IMG = '<img class="brand-logo h-8 w-auto object-contain group-hover:scale-105 transition-transform duration-300" alt="OccuHealth Logo" />';

// Verify each block really is the clock-icon span before touching anything.
for (const b of blocks) {
  const seg = lines.slice(b.start - 1, b.end).join('\n');
  if (!seg.includes('M12 21a9 9 0 100-18') || !seg.includes('class="relative flex items-center')) {
    console.error('VERIFICATION FAILED for block', b, ':\n', seg);
    process.exit(1);
  }
}

// Replace bottom-up so earlier line numbers stay valid.
for (const b of blocks) {
  const first = lines[b.start - 1];
  const cr = hasCR && first.endsWith('\r') ? '\r' : '';
  const base = hasCR ? first.slice(0, -1) : first;
  const indent = base.match(/^\s*/)[0];
  lines.splice(b.start - 1, b.end - b.start + 1, indent + IMG + cr);
}

fs.writeFileSync(file, lines.join('\n'));
console.log('OK: replaced', blocks.length, 'clock-icon <span> blocks with <img class="brand-logo">');
