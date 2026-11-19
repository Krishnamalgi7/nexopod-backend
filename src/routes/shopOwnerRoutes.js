const express = require("express");

const {
  loginShopOwner,
  getShopOwnerDetails,
  getShopOwnerDashboard,
  sendShopOwnerOtp,
} = require("../controllers/shopOwnerController");

const {
  getShopOwnerBookings,
  updatePhoneChargingBookingStatus,
} = require("../controllers/bookingController");

const {
  sendOtpLimiter,
  verifyOtpLimiter,
} = require("../middleware/otpRateLimit");

const {
  getShopOwnerNotifications,
  markShopOwnerNotificationRead,
  markAllShopOwnerNotificationsRead,
} = require("../controllers/notificationController");

const {
  submitStoreProfileChange,
  getMyStoreProfileChangeRequest,
} = require("../controllers/storeProfileChangeController");

const {
  getStoreProfileNotifications,
  markStoreProfileNotificationRead,
  markAllStoreProfileNotificationsRead,
} = require("../controllers/storeProfileNotificationController");

const shopOwnerVerify = require("../middleware/shopOwnerVerify");
const uploadStoreImages = require("../middleware/uploadStoreImages");
const router = express.Router();

router.post("/send-otp", sendOtpLimiter, sendShopOwnerOtp);

router.post("/login", verifyOtpLimiter, loginShopOwner);

// Get authenticated Shop Owner's store details
router.get("/me", shopOwnerVerify, getShopOwnerDetails);

// Submit store profile changes for Super Admin verification.
router.post(
  "/profile-change-request",
  shopOwnerVerify,
  uploadStoreImages,
  submitStoreProfileChange,
);

// Submit store name and image changes for Super Admin verification.
router.post(
  "/me/profile-change-request",
  shopOwnerVerify,
  uploadStoreImages,
  submitStoreProfileChange,
);

// Get the authenticated Shop Owner's latest profile-change request.
router.get(
  "/profile-change-request/me",
  shopOwnerVerify,
  getMyStoreProfileChangeRequest,
);

// Get dashboard data for the authenticated Shop Owner.
router.get("/dashboard", shopOwnerVerify, getShopOwnerDashboard);

// Get bookings for the authenticated Shop Owner's store.
router.get("/bookings", shopOwnerVerify, getShopOwnerBookings);

// Update a Phone Charging booking's session status.
router.patch(
  "/bookings/:bookingId/status",
  shopOwnerVerify,
  updatePhoneChargingBookingStatus,
);

// Get notifications for the authenticated Shop Owner.
router.get("/notifications", shopOwnerVerify, getShopOwnerNotifications);

// Mark one notification as read.
router.patch(
  "/notifications/:notificationId/read",
  shopOwnerVerify,
  markShopOwnerNotificationRead,
);

// Mark all notifications as read.
router.patch(
  "/notifications/read-all",
  shopOwnerVerify,
  markAllShopOwnerNotificationsRead,
);

// Get persistent store-profile notifications.
router.get(
  "/profile-notifications",
  shopOwnerVerify,
  getStoreProfileNotifications,
);

// Mark one store-profile notification as read.
router.patch(
  "/profile-notifications/:notificationId/read",
  shopOwnerVerify,
  markStoreProfileNotificationRead,
);

// Mark all store-profile notifications as read.
router.patch(
  "/profile-notifications/read-all",
  shopOwnerVerify,
  markAllStoreProfileNotificationsRead,
);

module.exports = router;
