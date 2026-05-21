import crypto from "crypto";
import { User } from "../models/user.model.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt"

function generateResetToken() {
    return crypto.randomBytes(32).toString("hex");
}

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Generate token and set expiry
        const token = generateResetToken();
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
        await user.save();

        // Create reset link
        const resetLink = `https://occuhealth.in/resetpassword.html?token=${token}`;

        // Nodemailer transporter (using Gmail as example)
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER, // e.g., your@gmail.com
                pass: process.env.EMAIL_PASS, // App password or real password
            },
        });

        // Email content
        const mailOptions = {
            from: `"OccuHealth" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Password Reset Request",
            html: `
        <p>Hello ${user.name || ""},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
        };

        // Send email
        await transporter.sendMail(mailOptions);

        res.json({ message: "Password reset link sent to email." });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ message: "An error occurred. Please try again." });
    }
};

const hashPassword = async (password) => {
  const saltRounds = 10; // Recommended rounds
  const hashed = await bcrypt.hash(password, saltRounds);
  return hashed;
};

const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        return res.status(400).json({ message: "Token invalid or expired." });
    }

    user.password = newPassword; // bcrypt hash
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful." });
};

export {
    forgotPassword,
    resetPassword
}
