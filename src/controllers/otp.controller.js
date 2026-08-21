import { OTP } from "../models/otp.model.js";
import { User } from "../models/user.model.js";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashCode(code) {
  const secret = process.env.OTP_HASH_SECRET || process.env.SUPER_ADMIN_ACCESS_TOKEN_SECRET || "development-otp-secret";
  return crypto.createHmac("sha256", secret).update(String(code)).digest("hex");
}

function normalizeIdentifier(identifier) {
  return String(identifier || "").trim().toLowerCase();
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
  const normalizedIdentifier = normalizeIdentifier(identifier);
  await OTP.deleteMany({ identifier: normalizedIdentifier, purpose });

  // save new OTP (now it's the only valid one)
  await OTP.create({ identifier: normalizedIdentifier, codeHash: hashCode(code), purpose, expiresAt });

  const transporter = await getTransporter();
  // sendTestEmail();
  if (transporter) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'no-reply@example.com',
      to: normalizedIdentifier,
      subject: `Your verification code`,
      text: `Your verification code is ${code}. It expires in 10 minutes.`
    });
    return res.json({ success: true, message: 'OTP sent' });
  }

  // Fallback: log code for dev
  if (process.env.NODE_ENV !== "production") console.log(`OTP generated for ${normalizedIdentifier}`);
  return res.json({ success: true, message: 'OTP generated (check server logs in dev)' });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { identifier, code, purpose = 'signup' } = req.body;
  if (!identifier || !code) return res.status(400).json({ message: 'identifier and code required' });

  // find latest OTP for identifier & purpose
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const otp = await OTP.findOne({ identifier: normalizedIdentifier, purpose }).sort({ createdAt: -1 });
  if (!otp) return res.status(404).json({ message: 'OTP not found' });
  
  // ✅ Check if expired
  if (otp.lockedUntil && otp.lockedUntil > new Date()) {
    return res.status(429).json({ message: 'Verification temporarily locked. Request a new OTP later.' });
  }
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
  if (otp.codeHash !== hashCode(code)) {
    otp.attempts = (otp.attempts || 0) + 1;
    if (otp.attempts >= 5) otp.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    await otp.save();
    return res.status(400).json({ 
      message: 'Invalid OTP',
      attemptsLeft: 5 - otp.attempts
    });
  }

  // ✅ Mark as verified
  otp.verified = true;
  otp.consumedAt = new Date();
  await otp.save();
  if (req.user?._id && purpose.startsWith("contact_")) {
    const update = purpose === "contact_email"
      ? { emailVerified: true, emailVerifiedAt: new Date(), normalizedEmail: normalizedIdentifier }
      : { phoneVerified: true, phoneVerifiedAt: new Date(), normalizedPhoneNumber: normalizedIdentifier, phoneNumber: normalizedIdentifier };
    await User.updateOne({ _id: req.user._id, tenantId: req.user.tenantId?._id || req.user.tenantId }, { $set: update });
  }
  return res.json({ success: true, message: 'OTP verified' });
});

export const sendVerificationOtp = asyncHandler(async (req, res) => {
  const { channel } = req.body;
  const user = await User.findById(req.user._id).select("email phoneNumber phoneNo").lean();
  if (!user) return res.status(404).json({ message: "User not found" });
  const identifier = channel === "email" ? user.email : user.phoneNumber || String(user.phoneNo || "");
  if (!identifier) return res.status(400).json({ message: `No ${channel} contact is available` });
  req.body.identifier = identifier;
  req.body.purpose = channel === "email" ? "contact_email" : "contact_phone";
  return sendOtp(req, res);
});

export const verifyVerificationOtp = asyncHandler(async (req, res) => {
  const { channel, code } = req.body;
  req.body.identifier = channel === "email" ? req.user.email : req.user.phoneNumber || String(req.user.phoneNo || "");
  req.body.purpose = channel === "email" ? "contact_email" : "contact_phone";
  req.body.code = code;
  return verifyOtp(req, res);
});

export const updateVerificationContact = asyncHandler(async (req, res) => {
  const { email, phoneNumber } = req.body;
  const update = {};
  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ message: "Invalid email" });
    const duplicate = await User.findOne({ normalizedEmail, _id: { $ne: req.user._id } }).select("_id").lean();
    if (duplicate) return res.status(409).json({ message: "Email already in use" });
    update.email = normalizedEmail;
    update.normalizedEmail = normalizedEmail;
    update.emailVerified = false;
    update.emailVerifiedAt = null;
  }
  if (phoneNumber !== undefined) {
    const normalizedPhoneNumber = String(phoneNumber).trim();
    if (!/^\+[1-9]\d{9,14}$/.test(normalizedPhoneNumber)) return res.status(400).json({ message: "Phone must include country code" });
    const duplicate = await User.findOne({ normalizedPhoneNumber, _id: { $ne: req.user._id } }).select("_id").lean();
    if (duplicate) return res.status(409).json({ message: "Phone already in use" });
    update.phoneNumber = normalizedPhoneNumber;
    update.normalizedPhoneNumber = normalizedPhoneNumber;
    update.phoneVerified = false;
    update.phoneVerifiedAt = null;
  }
  if (!Object.keys(update).length) return res.status(400).json({ message: "Email or phone is required" });
  await User.updateOne({ _id: req.user._id, tenantId: req.user.tenantId?._id || req.user.tenantId }, { $set: update });
  return res.json({ success: true, message: "Contact updated. Verification is required again." });
});
