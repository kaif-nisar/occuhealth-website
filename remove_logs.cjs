const fs = require('fs');
const path = require('path');

const targetFiles = [
    'c:\\Users\\EXPERT\\OneDrive\\Desktop\\occuhealth.in\\13-5\\13-5\\src\\controllers\\pdfgenerator.controller.js',
    'c:\\Users\\EXPERT\\OneDrive\\Desktop\\occuhealth.in\\13-5\\13-5\\private\\pages\\pages\\reportFormat.js',
    'c:\\Users\\EXPERT\\OneDrive\\Desktop\\occuhealth.in\\13-5\\13-5\\private\\pages\\pages\\reportFormat1.js',
    'c:\\Users\\EXPERT\\OneDrive\\Desktop\\occuhealth.in\\13-5\\13-5\\private\\pages\\pages\\reportFormat3.js',
    'c:\\Users\\EXPERT\\OneDrive\\Desktop\\occuhealth.in\\13-5\\13-5\\private\\pages\\pages\\reportFormat4.js'
];

targetFiles.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        // Comment out console.log statements
        let updatedContent = content.replace(/([ \t]*)(console\.log\()/g, '$1// $2');
        fs.writeFileSync(file, updatedContent);
        console.log('Removed console logs from:', file);
    }
});
