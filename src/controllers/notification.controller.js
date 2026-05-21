import {asyncHandler} from '../utils/asyncHandler.js';
import {Notification} from '../models/notification.model.js';
import cron from 'node-cron';
// ===========================================
// NOTIFICATION CONTROLLER FUNCTIONS
// ===========================================

// Get notifications for user/tenant
const getNotifications = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, type, isRead } = req.query;
    const userId = req.user.id;
    const tenantId = req.user.tenantId; 
    
    const filter = {
      $or: [
        { 'recipients.userId': userId },
        { 'recipients.tenantId': tenantId },
        { 'recipients.role': 'all' }
      ]
    };
    
    if (type) filter.type = type;
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email');
    
    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({
      ...filter,
      isRead: false
    });
    
    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark notification as read
const markAsRead = asyncHandler(async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;
    
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    // Add to readBy array if not already read by this user
    if (!notification.readBy.some(read => read.userId.toString() === userId)) {
      notification.readBy.push({ userId, readAt: new Date() });
      
      // If all recipients have read, mark as read
      const allRecipientsRead = notification.recipients.every(recipient => 
        notification.readBy.some(read => 
          read.userId.toString() === recipient.userId?.toString()
        )
      );
      
      if (allRecipientsRead) {
        notification.isRead = true;
      }
      
      await notification.save();
    }
    
    res.json({ success: true, message: 'Notification marked as read' });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark all notifications as read
const markAllAsRead = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    
    await Notification.updateMany(
      {
        $or: [
          { 'recipients.userId': userId },
          { 'recipients.tenantId': tenantId }
        ],
        isRead: false
      },
      { 
        $set: { isRead: true },
        $push: { readBy: { userId, readAt: new Date() } }
      }
    );
    
    res.json({ success: true, message: 'All notifications marked as read' });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete notification
const deleteNotification = asyncHandler(async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    await Notification.findByIdAndDelete(notificationId);
    res.json({ success: true, message: 'Notification deleted' });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// NOTIFICATION TRIGGERS IN BOOKING FLOW
// ===========================================

// In your booking creation endpoint
const createBooking = asyncHandler(async (req, res) => {
  try {
    // Your existing booking creation logic...
    const newBooking = await Booking.create(bookingData);
    
    // Trigger notification
    await NotificationService.notifyBookingConfirmed(newBooking);
    
    res.json({ success: true, data: newBooking });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// In your booking status update endpoint
const updateBookingStatus = asyncHandler(async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    
    const booking = await Booking.findByIdAndUpdate(
      bookingId, 
      { status, updatedAt: new Date() }, 
      { new: true }
    );
    
    // Trigger appropriate notifications based on status
    switch (status) {
      case 'completed':
        await NotificationService.notifyReportReady(booking);
        break;
      case 'cancelled':
        await NotificationService.createNotification({
          title: 'Booking Cancelled',
          message: `Booking ${booking.bookingId} has been cancelled.`,
          type: 'booking_cancelled',
          recipients: [{ userId: booking.createdBy, role: 'user' }],
          relatedData: { bookingId: booking.bookingId },
          priority: 'medium',
          channels: { inApp: true, email: true }
        });
        break;
    }
    
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// SCHEDULED NOTIFICATION CRON JOBS
// ===========================================

// Check for subscription expiring (daily at 9 AM)
cron.schedule('0 9 * * *', async () => {
  try {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const expiringSubscriptions = await Tenant.find({
      endDate: { $lte: sevenDaysFromNow },
      paymentStatus: 'paid'
    });
    
    for (const tenant of expiringSubscriptions) {
      await NotificationService.notifySubscriptionExpiring(tenant);
    }
  } catch (error) {
    console.error('Error in subscription expiry check:', error);
  }
});

// Check for pending payments (daily at 10 AM)
cron.schedule('0 10 * * *', async () => {
  try {
    const pendingPayments = await Booking.find({
      status: 'pending',
      createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24 hours old
    });
    
    for (const booking of pendingPayments) {
      await NotificationService.notifyPaymentPending(booking);
    }
  } catch (error) {
    console.error('Error in pending payment check:', error);
  }
});

// ===========================================
// NOTIFICATION ROUTES
// ===========================================

// const express = require('express');
// const { Schema } = require('mongoose');
// const router = express.Router();

// router.get('/notifications', getNotifications);
// router.put('/notifications/:notificationId/read', markAsRead);
// router.put('/notifications/mark-all-read', markAllAsRead);
// router.delete('/notifications/:notificationId', deleteNotification);

export { 
//   NotificationService, 
//   router,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification 
};