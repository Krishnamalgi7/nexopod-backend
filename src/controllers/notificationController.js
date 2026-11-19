const mongoose = require("mongoose");
const Notification = require("../models/Notification");

// Get notifications for the authenticated Shop Owner's store.
const getShopOwnerNotifications = async (req, res) => {
  try {
    const storeId = req.store._id;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({
        storeId,
        isRead: false,
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),

      Notification.countDocuments({
        storeId,
        isRead: false,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully.",
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    console.error("[Notifications] Fetch failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch notifications.",
    });
  }
};

// Mark one notification as read.
const markShopOwnerNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        storeId: req.store._id,
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
    console.error("[Notifications] Mark-read failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update notification.",
    });
  }
};

// Mark all notifications as read.
const markAllShopOwnerNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        storeId: req.store._id,
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
      message: "All notifications marked as read.",
    });
  } catch (error) {
    console.error("[Notifications] Mark-all-read failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update notifications.",
    });
  }
};

module.exports = {
  getShopOwnerNotifications,
  markShopOwnerNotificationRead,
  markAllShopOwnerNotificationsRead,
};
