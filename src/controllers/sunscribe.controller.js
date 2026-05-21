import {Subscriber} from "../models/subscribe.model.js";
import nodemailer from "nodemailer";

// Setup Nodemailer transporter (use your credentials)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'kaifquest786@gmail.com',       // ✅ Replace with your email
    pass: 'tbgljldaqkvzafvg'           // ✅ Use App Password (not your main password)
  }
});

const subscribe = async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'Invalid email address' });
  }

  try {
    const existing = await Subscriber.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'You are already subscribed!' });
    }

    const newSubscriber = await Subscriber.create({ email });

    // Send confirmation email
    await transporter.sendMail({
      from: '"Health Newsletter" <kaifquest786@gmail.com>',   // ✅ your email
      to: email,
      subject: "🎉 Thank you for subscribing!",
      html: `
        <h2>Welcome to our Newsletter!</h2>
        <p>Thank you for subscribing to health tips and updates.</p>
        <p>Stay tuned for exciting content! 💪</p>
        <hr>
        <p>If you didn't request this, please ignore.</p>
      `
    });

    res.status(200).json({ message: 'Thanks for subscribing! Confirmation email sent.' });
  } catch (err) {
    console.error('Subscribe Error:', err.message);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

export {subscribe};