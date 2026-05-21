// import twilio from 'twilio';
import axios from 'axios';
import nodemailer from 'nodemailer';
import multer from 'multer';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import { Request } from '../models/request.model.js';
import { SuperAdminNotification } from '../models/superadminnotification.model.js';

// Twilio credentials
const accountSid = 'AC01ebdcdef6050c6e56be55a6170a62e9'; // Replace with your Twilio SID
const authToken = '4522d8fe1ebe133f257737203a0e5ec6';  // Replace with your Twilio Auth Token

// Create a Twilio client instance
// const client = twilio(accountSid, authToken);

/**
 * Uploads a file to File.io and returns the shareable link.
 * @param {string} localPath - Path to the file to upload.
 * @returns {Promise<string>} - Shareable link from File.io.
 */

async function sendSMS(req, res) {
    const { phoneNumber, message } = req.body;

    const file = req.files?.pdf?.[0]; // Single file uploaded via Multer

    if (!file) {
        throw new Error("Please provide a PDF file");
    }

    // Use File.io utility to upload the file and get the download link
    // const pdfUrl = await uploadPDFToFileIO(file.path);

    await fs.unlink(file.path);

    if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'Phone number and message are required.' });
    }

    // Ensure phone number is in E.164 format
    let formattedPhoneNumber = phoneNumber.trim();

    // Add country code if missing
    if (!formattedPhoneNumber.startsWith('+')) {
        formattedPhoneNumber = `+91${formattedPhoneNumber}`; // Replace +91 with your desired country code
    }

    try {
        const sms = await client.messages.create({
            body: `${message}\nDownload your PDF here: ${pdfUrl}`,
            from: '+19789568454', // Replace with your Twilio number
            to: formattedPhoneNumber, // Use the formatted phone number
        });

        res.status(200).json({ success: true, message: 'SMS sent successfully.', sid: sms.sid });
    } catch (error) {
        console.error('Error sending SMS:', error);
        res.status(500).json({ success: false, error: 'Failed to send SMS.', details: error.message });
    }
}

const transporter = nodemailer.createTransport({
    service: 'gmail', // Or your email provider
    auth: {
        user: 'kaifquest786@gmail.com', // Replace with your email
        pass: 'tbgljldaqkvzafvg', // Replace with your email password or app password
    },
});

async function sendEmail(req, res) {
    const { email, subject, body } = req.body;

    console.log(req.files);
    const file = req.files?.pdf?.[0]; // Single file uploaded via Multer

    if (!file) {
        throw new Error("Please provide a valid WhatsApp number and PDF file");
    }

    // Path of the uploaded file in the temp directory
    // const filePath = `./public/temp/${file.filename}`;

    // Use Dropbox utility to upload the file and get the download link
    const pdfUrl = await uploadPDFToFileIO(file.path);

    if (!email || !subject || !body || !pdfUrl) {
        return res.status(400).json({ error: 'Email, subject, body, and PDF URL are required.' });
    }

    try {
        const mailOptions = {
            from: 'kaifquest786@gmail.com', // Replace with your email
            to: email,
            subject: subject,
            text: `${body}\n\nDownload your report PDF here: ${pdfUrl}`, // Fallback for text-only email clients
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <p style="font-size: 16px;">${body}</p>
                    <p style="font-size: 18px; font-weight: bold;">
                        <a href="${pdfUrl}" target="_blank" style="color: #007BFF; text-decoration: none;">
                            Click here to download your PDF report
                        </a>
                    </p>
                    <p style="font-size: 12px; color: #888;">
                        If you have any questions, reply to this email. <br/>
                        Reference ID: ${Date.now()}
                    </p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true, message: 'Email sent successfully.' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Failed to send email.' });
    }
}

// SMTP transporter
// const transporter = nodemailer.createTransport({
//     host: "smtp.example.com",
//     port: 587,
//     secure: false,
//     auth: {
//         user: "your_email@example.com",
//         pass: "your_email_password"
//     }
// });

// Handler function
const handleRequest = async (req, res) => {
    try {
        const { name, email, phone, city, plan } = req.body;

        if (!name || !email || !phone || !city || !plan) {
            return res.status(500).json({ message: 'Missing required feilds' });
        }
        // Save request to database
        const requestDoc = await Request.create({
            name,
            email,
            phone,
            city,
            plan,
            createdAt: new Date()
        });

        if (!requestDoc) {
            return res.status(400).json({ message: 'Something went wrong ! please try again' });
        }

        // Send email to admin
        await transporter.sendMail({
            from: '"OccuHealth.in" <occuhealth.info1@gmail.com>',
            to: "occuhealth.info1@gmail.com",
            subject: `New Request from ${name}, ${plan} plan`,
            html: `
        <h2>New Request Details</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>City:</strong> ${city}</p>
        <p><strong>Plan:</strong> ${plan}</p>
      `
        });

        // Send confirmation email to user
        await transporter.sendMail({
            from: '"Occuheath.in" <occuhealth.info1@gmail.com>',
            to: email,
            subject: "Your Request has been Received",
            html: `
        <p>Dear ${name},</p>
        <p>Thank you for your interest in our services. Your request has been received and we will contact you soon.</p>
        <p>Regards,<br>from Occuhealth</p>
      `
        });

        const notificationdoc = await SuperAdminNotification.create({
            userEmail: email,
            message: `Request submitted successfully for plan: ${plan}`,
            relatedPlan: plan,
            type: "success",
            deliveryStatus: "sent"
        });

        if (!notificationdoc) {
            return res.status(405).json({ message: 'Something went wrong ! please try again' });
        }

        res.status(200).json({ message: "Request processed successfully." });

    } catch (error) {
        console.error("Error handling request:", error.message);
        res.status(500).json({ message: "Internal server error." });
    }
};


export {
    sendSMS, sendEmail,
    handleRequest
}
