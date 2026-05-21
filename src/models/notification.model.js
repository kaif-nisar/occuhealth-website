import mongoose,{Schema} from 'mongoose';
// ===========================================
// NOTIFICATION SCHEMA & MODEL
// ===========================================

const notificationSchema = new mongoose.Schema({
  // Basic Fields
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: [
      'booking_confirmed', 'booking_cancelled', 'booking_updated',
      'report_ready', 'payment_pending', 'payment_success', 'payment_failed',
      'courier_assigned', 'sample_collected', 'test_completed',
      'subscription_expiring', 'subscription_expired', 'subscription_renewed',
      'new_user_registered', 'commission_earned', 'system_maintenance',
      'equipment_available', 'booking_reminder', 'overdue_payment'
    ],
    required: true 
  },
  
  // Recipients
  recipients: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tenantId: { type: mongoose.Schema.Types.ObjectId },
    role: { type: String, enum: ['admin', 'franchisee', 'user', 'all'] }
  }],
  
  // Related Data
  relatedData: {
    bookingId: { type: String },
    orderId: { type: String },
    amount: { type: Number },
    tenantId: { type: mongoose.Schema.Types.ObjectId },
    userId: { type: mongoose.Schema.Types.ObjectId }
  },
  
  // Status & Tracking
  isRead: { type: Boolean, default: false },
  readBy: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId },
    readAt: { type: Date, default: Date.now }
  }],
  
  // Priority & Scheduling
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'], 
    default: 'medium' 
  },
  scheduledFor: { type: Date }, // For scheduled notifications
  
  // Delivery Channels
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: false }
  },
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tenantId: { type: mongoose.Schema.Types.ObjectId },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

notificationSchema.index({ tenantId: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1, createdAt: -1 });
notificationSchema.index({ "recipients.userId": 1, createdAt: -1 });
notificationSchema.index({ "recipients.tenantId": 1, createdAt: -1 });
notificationSchema.index({ "recipients.role": 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);

// ===========================================
// NOTIFICATION SERVICE CLASS
// ===========================================

class NotificationService {
  
  // Create notification
  static async createNotification(data) {
    try {
      const notification = new Notification(data);
      await notification.save();
      
      // Send to different channels
      if (data.channels?.email) await this.sendEmailNotification(notification);
      if (data.channels?.sms) await this.sendSMSNotification(notification);
      if (data.channels?.push) await this.sendPushNotification(notification);
      
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }
  
  // Booking Related Notifications
  static async notifyBookingConfirmed(bookingData) {
    const notificationData = {
      title: 'Booking Confirmed!',
      message: `Your booking ${bookingData.bookingId} for ${bookingData.patientName} has been confirmed.`,
      type: 'booking_confirmed',
      recipients: [
        { userId: bookingData.createdBy, role: 'user' },
        { tenantId: bookingData.tenantId, role: 'admin' }
      ],
      relatedData: {
        bookingId: bookingData.bookingId,
        tenantId: bookingData.tenantId,
        amount: bookingData.total
      },
      priority: 'high',
      channels: { inApp: true, email: true, sms: true }
    };
    
    return await this.createNotification(notificationData);
  }
  
  static async notifyReportReady(bookingData) {
    return await this.createNotification({
      title: 'Test Report Ready',
      message: `Test report for booking ${bookingData.bookingId} is ready for download.`,
      type: 'report_ready',
      recipients: [{ userId: bookingData.createdBy, role: 'user' }],
      relatedData: { bookingId: bookingData.bookingId },
      priority: 'high',
      channels: { inApp: true, email: true, sms: true }
    });
  }
  
  static async notifyPaymentPending(bookingData) {
    return await this.createNotification({
      title: 'Payment Pending',
      message: `Payment of ₹${bookingData.total} is pending for booking ${bookingData.bookingId}`,
      type: 'payment_pending',
      recipients: [{ userId: bookingData.createdBy, role: 'user' }],
      relatedData: { 
        bookingId: bookingData.bookingId,
        amount: bookingData.total 
      },
      priority: 'urgent',
      channels: { inApp: true, email: true }
    });
  }
  
  // Subscription Notifications
  static async notifySubscriptionExpiring(tenantData) {
    return await this.createNotification({
      title: 'Subscription Expiring Soon',
      message: `Your subscription will expire on ${tenantData.endDate}. Please renew to continue services.`,
      type: 'subscription_expiring',
      recipients: [{ tenantId: tenantData._id, role: 'admin' }],
      relatedData: { tenantId: tenantData._id },
      priority: 'high',
      channels: { inApp: true, email: true }
    });
  }
  
  // Commission Notifications
  static async notifyCommissionEarned(franchiseeData, amount, bookingId) {
    return await this.createNotification({
      title: 'Commission Earned!',
      message: `You earned ₹${amount} commission from booking ${bookingId}`,
      type: 'commission_earned',
      recipients: [{ userId: franchiseeData.userId, role: 'franchisee' }],
      relatedData: { 
        bookingId: bookingId,
        amount: amount,
        tenantId: franchiseeData.tenantId 
      },
      priority: 'medium',
      channels: { inApp: true, email: true }
    });
  }
  
  // System Notifications
  static async notifySystemMaintenance(message, scheduledFor) {
    return await this.createNotification({
      title: 'System Maintenance Alert',
      message: message,
      type: 'system_maintenance',
      recipients: [{ role: 'all' }],
      scheduledFor: scheduledFor,
      priority: 'high',
      channels: { inApp: true, email: true }
    });
  }
  
  // Send Email (Integration with your email service)
  static async sendEmailNotification(notification) {
    // Implement email sending logic
    console.log('Sending email notification:', notification.title);
    // Use nodemailer, sendgrid, etc.
  }
  
  // Send SMS (Integration with SMS service)
  static async sendSMSNotification(notification) {
    // Implement SMS sending logic
    console.log('Sending SMS notification:', notification.title);
    // Use Twilio, MSG91, etc.
  }
  
  // Send Push Notification
  static async sendPushNotification(notification) {
    // Implement push notification logic
    console.log('Sending push notification:', notification.title);
    // Use Firebase, OneSignal, etc.
  }
}
