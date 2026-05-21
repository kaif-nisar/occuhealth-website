// utils/subscriptionScheduler.js
import cron from "node-cron";
import { User } from "../models/user.model.js";
import nodemailer from "nodemailer";
import { Tenant } from "../models/tenant.model.js";
import { cleanupCustomizationsOnStartup } from "./customizationCleanup.js";

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Check and deactivate expired subscriptions - runs daily at 12:01 AM
export const scheduleSubscriptionCheck = () => {
  cron.schedule("1 0 * * *", async () => {
    try {
      console.log("Running subscription check...");
      const expiredTenants = await Tenant.deactivateExpiredTenants();
      console.log(`Deactivated ${expiredCount} expired subscriptions`);
      console.log(`Deactivated ${expiredTenants} expired tenants`);
    } catch (error) {
      console.error("Error in subscription check:", error);
    }
  });
};

// Send expiry warnings - runs daily at 10:00 AM
export const scheduleExpiryWarnings = () => {
  cron.schedule("0 10 * * *", async () => {
    try {
      console.log("Sending expiry warnings...");
      const expiringUsers = await Tenant.getExpiringSubscriptions(5);

      for (const user of expiringUsers) {
        await sendExpiryWarningEmail(user);
      }

      console.log(`Sent expiry warnings to ${expiringUsers.length} users`);
    } catch (error) {
      console.error("Error sending expiry warnings:", error);
    }
  });
};

// Cleanup customizations - runs daily at 3:00 AM
export const scheduleCustomizationCleanup = () => {
  cron.schedule("0 3 * * *", async () => {
    try {
      console.log("[Customization Cleanup] Scheduled cleanup started");
      await cleanupCustomizationsOnStartup();
      console.log("[Customization Cleanup] Scheduled cleanup completed");
    } catch (error) {
      console.error("[Customization Cleanup] Scheduled cleanup failed:", error);
    }
  });
};

// Send expiry warning email
const sendExpiryWarningEmail = async (user) => {
  try {
    const daysLeft = Math.ceil(
      (user.subscription.endDate - new Date()) / (1000 * 60 * 60 * 24)
    );

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `Subscription Expiring Soon - ${daysLeft} days left`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff6b35;">Subscription Expiring Soon!</h2>
          <p>Dear ${user.fullName},</p>
          <p>Your subscription is expiring in <strong>${daysLeft} days</strong> on ${user.subscription.endDate.toDateString()}.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Current Plan Details:</h3>
            <p><strong>Plan:</strong> ${user.subscription.plan}</p>
            <p><strong>Amount:</strong> ₹${user.subscription.amount}</p>
            <p><strong>Expires on:</strong> ${user.subscription.endDate.toDateString()}</p>
          </div>
          
          ${
            user.commissionWallet > 0
              ? `
          <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
            <p><strong>Good News!</strong> You have ₹${user.commissionWallet} in your commission wallet that you can use for renewal.</p>
          </div>
          `
              : ""
          }
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/renew-subscription" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Renew Now
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If you don't renew your subscription, your account will be deactivated after the expiry date.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    // Log activity
    await user.logActivity("expiry_warning_sent", {
      daysLeft: daysLeft,
      expiryDate: user.subscription.endDate,
    });
  } catch (error) {
    console.error(`Error sending expiry warning to ${user.email}:`, error);
  }
};

// Initialize all schedulers
export const initializeSchedulers = () => {
  scheduleSubscriptionCheck();
  scheduleExpiryWarnings();
  scheduleCustomizationCleanup();
  // Run once on server start
  (async () => {
    try {
      console.log("Initial subscription check on server start...");
      const expiredCount = await Tenant.deactivateExpiredSubscriptions();
      console.log(`Deactivated ${expiredCount} expired subscriptions`);
    } catch (error) {
      console.error("Error in initial subscription check:", error);
    }
  })();
  console.log("Subscription schedulers initialized");
};

// Manual functions for testing
export const manualSubscriptionCheck = async () => {
  try {
    const expiredCount = await Tenant.deactivateExpiredSubscriptions();
    return { success: true, expiredCount };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const manualExpiryWarnings = async () => {
  try {
    const expiringUsers = await Tenant.getExpiringSubscriptions(5);

    for (const user of expiringUsers) {
      await sendExpiryWarningEmail(user);
    }

    return { success: true, warningsSent: expiringUsers.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
