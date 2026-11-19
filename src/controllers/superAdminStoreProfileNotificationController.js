
const mongoose = require("mongoose");
const StoreProfileNotification = require("../models/StoreProfileNotification");

// Get persistent store-profile notifications for Super Admins.
const getSuperAdminStoreProfileNotifications = async (req, res) => {
  try {
    const filter = {
      recipientRole: "superAdmin",
    };

    const [notifications, unreadCount, total] = await Promise.all([
      StoreProfileNotification.find(filter)
        .populate("storeId", "name contactNumber image")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),

      StoreProfileNotification.countDocuments({
        ...filter,
        isRead: false,
      }),

      StoreProfileNotification.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Store-profile notifications fetched successfully.",
      data: {
        notifications,
        unreadCount,
        total,
      },
    });
  } catch (error) {
    console.error(
      "[Super Admin Notifications] Fetch failed:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch store-profile notifications.",
    });
  }
};

// Mark one Super Admin notification as read.
const markSuperAdminStoreProfileNotificationRead = async (req, res) => {
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
          recipientRole: "superAdmin",
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
      ).populate("storeId", "name contactNumber image");

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
      "[Super Admin Notifications] Mark-read failed:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to mark notification as read.",
    });
  }
};

// Mark all Super Admin notifications as read.
const markAllSuperAdminStoreProfileNotificationsRead = async (req, res) => {
  try {
    const result = await StoreProfileNotification.updateMany(
      {
        recipientRole: "superAdmin",
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
      message: "All store-profile notifications marked as read.",
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error(
      "[Super Admin Notifications] Mark-all-read failed:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to mark notifications as read.",
    });
  }
};

module.exports = {
  getSuperAdminStoreProfileNotifications,
  markSuperAdminStoreProfileNotificationRead,
  markAllSuperAdminStoreProfileNotificationsRead,
};
