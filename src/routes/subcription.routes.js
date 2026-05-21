// routes/subscriptionRoutes.js
import express from "express";
import {
  createSubscriptionOrder,
  verifySubscriptionPayment,
  renewWithCommission,
  getSubscriptionStatus,
  requestWithdrawal,
  getWithdrawalHistory,
  getReferralDashboard,
  registerWithReferral,
  processWithdrawalRequest,
  getAllWithdrawalRequests,
  getDashboardStats
} from "../controllers/subscription.controller.js";
import { verifyJWT, verifySuperAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// User routes
router.post("/create-order", verifyJWT, createSubscriptionOrder);
router.post("/verify-payment", verifyJWT, verifySubscriptionPayment);
router.post("/renew-with-commission", verifyJWT, renewWithCommission);
router.get("/status", verifyJWT, getSubscriptionStatus);

// Referral routes
router.get("/referral-dashboard", verifyJWT, getReferralDashboard);
router.post("/register-with-referral", registerWithReferral);

// Withdrawal routes
router.post("/request-withdrawal", verifyJWT, requestWithdrawal);
router.get("/withdrawal-history", verifyJWT, getWithdrawalHistory);

// Super Admin routes
router.post("/process-withdrawal", verifySuperAdmin, processWithdrawalRequest);
router.get("/all-withdrawals", verifySuperAdmin, getAllWithdrawalRequests);
router.get("/dashboard-stats", verifyJWT, getAllWithdrawalRequests);
export default router;

// middleware/subscriptionMiddleware.js
import { User } from "../models/user.model.js";

// Middleware to check if user's subscription is active
export const checkSubscriptionStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if subscription is expired
    if (user.isSubscriptionExpired()) {
      await user.deactivateExpiredSubscription();
      return res.status(403).json({
        message: "Your subscription has expired. Please renew to continue.",
        subscriptionExpired: true,
        renewalUrl: "/renew-subscription"
      });
    }
    
    // Check if subscription is expiring soon
    if (user.isSubscriptionExpiringSoon()) {
      const daysLeft = Math.ceil((user.subscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
      res.locals.subscriptionWarning = {
        message: `Your subscription expires in ${daysLeft} days`,
        daysLeft: daysLeft,
        renewalUrl: "/renew-subscription"
      };
    }
    
    next();
  } catch (error) {
    console.error("Error checking subscription status:", error);
    res.status(500).json({ message: "Error checking subscription status" });
  }
};

// Middleware to check if user can access premium features
export const checkPremiumAccess = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (!user.subscription.isActive || user.isSubscriptionExpired()) {
      return res.status(403).json({ 
        message: "Premium access required. Please renew your subscription.",
        subscriptionExpired: true
      });
    }
    
    next();
  } catch (error) {
    console.error("Error checking premium access:", error);
    res.status(500).json({ message: "Error checking access permissions" });
  }
};

// utils/emailTemplates.js
export const getWelcomeEmailTemplate = (user) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">Welcome to Our Platform!</h1>
      </div>
      
      <div style="padding: 30px;">
        <h2>Hello ${user.fullName}!</h2>
        <p>Welcome to our platform! Your account has been successfully created.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Your Account Details:</h3>
          <p><strong>Username:</strong> ${user.username}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Referral Code:</strong> <code style="background-color: #e9ecef; padding: 4px 8px; border-radius: 4px;">${user.referral.referralCode}</code></p>
        </div>
        
        <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
          <h4>🎉 Share and Earn!</h4>
          <p>Share your referral code with friends and earn 20% commission on every subscription they purchase!</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin-top: 20px;">
          <h4>⏰ Subscription Info</h4>
          <p>Your subscription is active until <strong>${user.subscription.endDate.toDateString()}</strong></p>
          <p>We'll remind you before it expires so you can renew seamlessly.</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #666;">
        <p>Need help? Contact our support team at support@yourplatform.com</p>
        <p style="font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;
};

export const getReferralCommissionEmailTemplate = (referrer, referredUser, commissionAmount) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">🎉 Commission Earned!</h1>
      </div>
      
      <div style="padding: 30px;">
        <h2>Congratulations ${referrer.fullName}!</h2>
        <p>You've earned a referral commission!</p>
        
        <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border: 2px solid #28a745; text-align: center; margin: 20px 0;">
          <h3 style="color: #28a745; margin: 0 0 10px 0;">Commission Earned</h3>
          <h2 style="color: #28a745; margin: 0; font-size: 36px;">₹${commissionAmount}</h2>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h4>Commission Details:</h4>
          <p><strong>Referred User:</strong> ${referredUser.fullName}</p>
          <p><strong>Commission Rate:</strong> 20%</p>
          <p><strong>Date:</strong> ${new Date().toDateString()}</p>
        </div>
        
        <div style="background-color: #e2e3e5; padding: 15px; border-radius: 8px;">
          <h4>Your Commission Summary:</h4>
          <p><strong>Current Balance:</strong> ₹${referrer.commissionWallet}</p>
          <p><strong>Total Earned:</strong> ₹${referrer.referral.totalCommissionEarned}</p>
          <p><strong>Total Referrals:</strong> ${referrer.referral.totalReferrals}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/referral-dashboard" 
             style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
            View Dashboard
          </a>
          <a href="${process.env.FRONTEND_URL}/withdraw" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Request Withdrawal
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; text-align: center;">
          Keep sharing your referral code to earn more commissions!
        </p>
      </div>
    </div>
  `;
};