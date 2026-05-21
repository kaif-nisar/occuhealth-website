import { OTP } from "../models/otp.model.js";
import nodemailer from "nodemailer";
import { asyncHandler } from "../utils/asyncHandler.js";

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  // No SMTP configured — return null so caller can fallback to console.log
  return null;
}

// async function sendTestEmail() {
//   const transporter = await getTransporter();
  
//   if (!transporter) {
//     console.log('SMTP not configured');
//     return;
//   }

//   try {
//     // Connection verify karo
//     await transporter.verify();
//     console.log('✅ SMTP connection verified');

//     // Test email bhejo
//     const info = await transporter.sendMail({
//       from: process.env.SMTP_USER,
//       to: 'recipient@example.com', // Replace with actual email
//       subject: 'Test Email',
//       text: 'This is a test email',
//       html: '<p>This is a test email</p>'
//     });

//     console.log('✅ Email sent:', info.messageId);
//   } catch (error) {
//     console.error('❌ Error:', error.message);
//   }
// }

// sendTestEmail();

export const sendOtp = asyncHandler(async (req, res) => {
  const { identifier, purpose = 'signup' } = req.body; // identifier: email or phone
  if (!identifier) return res.status(400).json({ message: 'identifier required' });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + (10 * 60 * 1000)); // 10 minutes

  // ✅ IMPORTANT: Invalidate all previous OTPs for this identifier & purpose
  // So only the latest OTP is valid (prevents multiple valid OTPs)
  await OTP.deleteMany({ identifier, purpose });

  // save new OTP (now it's the only valid one)
  await OTP.create({ identifier, code, purpose, expiresAt });

  const transporter = await getTransporter();
  // sendTestEmail();
  if (transporter) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'no-reply@example.com',
      to: identifier,
      subject: `Your verification code`,
      text: `Your verification code is ${code}. It expires in 10 minutes.`
    });
    return res.json({ success: true, message: 'OTP sent' });
  }

  // Fallback: log code for dev
  console.log(`OTP for ${identifier}: ${code}`);
  return res.json({ success: true, message: 'OTP generated (check server logs in dev)' });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { identifier, code, purpose = 'signup' } = req.body;
  if (!identifier || !code) return res.status(400).json({ message: 'identifier and code required' });

  // find latest OTP for identifier & purpose
  const otp = await OTP.findOne({ identifier, purpose }).sort({ createdAt: -1 });
  if (!otp) return res.status(404).json({ message: 'OTP not found' });
  
  // ✅ Check if expired
  if (otp.expiresAt < new Date()) {
    await otp.deleteOne(); // Delete expired OTP
    return res.status(400).json({ message: 'OTP expired' });
  }

  // ✅ Check attempt limit (max 5 attempts)
  if ((otp.attempts || 0) >= 5) {
    await otp.deleteOne(); // Delete after max attempts
    return res.status(429).json({ message: 'Too many failed attempts. Request a new OTP.' });
  }

  // ✅ Check code
  if (otp.code !== String(code)) {
    otp.attempts = (otp.attempts || 0) + 1;
    await otp.save();
    return res.status(400).json({ 
      message: 'Invalid OTP',
      attemptsLeft: 5 - otp.attempts
    });
  }

  // ✅ Mark as verified
  otp.verified = true;
  await otp.save();
  return res.json({ success: true, message: 'OTP verified' });
});
