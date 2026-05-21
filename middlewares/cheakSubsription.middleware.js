import { User } from '../src/models/user.model.js'

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