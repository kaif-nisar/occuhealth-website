import qr from 'qrcode';

const qrcodecontroller = async (req, res) => {
    const { link } = req.body;

    if (!link) {
        return res.status(400).json({ message: 'Link is required to generate QR code.' });
    }

    try {
        // Generate QR code as base64 string
        const qrCodeDataUrl = await qr.toDataURL(link,{
            margin:2
        });

        // Send the QR code data URL to the frontend
        res.status(200).json({ qrCode: qrCodeDataUrl });
    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({ message: 'Failed to generate QR code.' });
    }
}

export {qrcodecontroller}