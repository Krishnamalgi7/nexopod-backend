
const mongoose = require("mongoose");

const StoreProfileNotification = require("../models/StoreProfileNotification");

// Get persistent profile-change notifications for the authenticated Shop Owner.
const getStoreProfileNotifications = async (req, res) => {
  try {
    const storeId = req.store._id;

    const [notifications, unreadCount, total] = await Promise.all([
      StoreProfileNotification.find({
        storeId,
        recipientRole: "shopOwner",
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),

      StoreProfileNotification.countDocuments({
        storeId,
        recipientRole: "shopOwner",
        isRead: false,
      }),

      StoreProfileNotification.countDocuments({
        storeId,
        recipientRole: "shopOwner",
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Store profile notifications fetched successfully.",
      data: {
        notifications,
        unreadCount,
        total,
      },
    });
  } catch (error) {
    console.error(
      "[Store Profile Notifications] Fetch failed:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch store profile notifications.",
    });
  }
};

// Mark one profile-change notification as read.
const markStoreProfileNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    if (!mongoose.isValidObjectId(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    const notification =
      await StoreProfileNotification.findOneAndUpdate(
        {
          _id: notificationId,
          storeId: req.store._id,
          recipientRole: "shopOwner",
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        },
        {
          new: true,
        },
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: { notification },
    });
  } catch (error) {
    console.error(
      "[Store Profile Notifications] Mark-read failed:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to mark notification as read.",
    });
  }
};

// Mark all profile-change notifications as read.
const markAllStoreProfileNotificationsRead = async (req, res) => {
  try {
    const result = await StoreProfileNotification.updateMany(
      {
        storeId: req.store._id,
        recipientRole: "shopOwner",
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "All store profile notifications marked as read.",
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error(
      "[Store Profile Notifications] Mark-all-read failed:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to mark notifications as read.",
    });
  }
};

module.exports = {
  getStoreProfileNotifications,
  markStoreProfileNotificationRead,
  markAllStoreProfileNotificationsRead,
};
