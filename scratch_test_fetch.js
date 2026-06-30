import fetch from 'node-fetch';

const urls = [
    "https://res.cloudinary.com/dbpdu0lpg/image/upload/v1782746028/booking-attachments/file_cenjxq.pdf",
    "https://res.cloudinary.com/dbpdu0lpg/image/upload/v1782747181/booking-attachments/file_tisclm.pdf",
    "https://res.cloudinary.com/dbpdu0lpg/image/upload/v1782805375/booking-attachments/file_ae9lct.pdf",
    "https://res.cloudinary.com/dbpdu0lpg/raw/upload/v1782810749/booking-attachments/file_o8fls5"
];

async function run() {
    for (const url of urls) {
        try {
            console.log(`Fetching: ${url}`);
            const res = await fetch(url);
            console.log(`  Status: ${res.status} ${res.statusText}`);
            console.log(`  Content-Type: ${res.headers.get('content-type')}`);
            console.log(`  Content-Length: ${res.headers.get('content-length')}`);
        } catch (err) {
            console.error(`  Error:`, err.message);
        }
    }
}

run();
