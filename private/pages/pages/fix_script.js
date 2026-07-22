const fs = require('fs');
const files = [
  'reportFormat1.js',
  'reportFormat3.js',
  'reportFormat4.js'
];
const dir = 'c:\\Users\\EXPERT\\OneDrive\\Desktop\\occuhealth.in\\13-5\\13-5\\private\\pages\\pages\\';
files.forEach(f => {
  let content = fs.readFileSync(dir + f, 'utf8');
  
  // 1. Add bookingId: report.bookingId after reportId: value1
  content = content.replace(/reportId:\s*value1(,?)/g, 'reportId: value1, bookingId: report.bookingId$1');
  
  // 2. Hide download-pdf-div at top
  if(!content.includes("downloadPdfDiv.style.display = 'none'")) {
      content = content.replace(/\(async function \(\) \{/, "(async function () {\n    const downloadPdfDiv = document.querySelector('.download-pdf-div');\n    if (downloadPdfDiv) downloadPdfDiv.style.display = 'none';\n");
  }

  // 3. Show at bottom
  if(!content.includes("downloadPdfDiv.style.display = 'flex'")) {
      content = content.replace(/await sendReport\(\);\s*(function hidecontent\(\))/g, "await sendReport();\n    if (downloadPdfDiv) downloadPdfDiv.style.display = 'flex';\n\n    $1");
  }

  fs.writeFileSync(dir + f, content);
});
console.log('Done');
