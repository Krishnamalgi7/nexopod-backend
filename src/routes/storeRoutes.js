const express = require("express");

const {
  createStore,
  getStores,
  getStoreStats,
  updateStoreStatus,
  updateStoreDetails,
} = require("../controllers/storeController");

const {
  getPendingStoreProfileRequests,
  getStoreProfileRequestById,
  approveStoreProfileRequest,
  rejectStoreProfileRequest,
  getPendingStoreProfileImage,
} = require("../controllers/storeProfileReviewController");

const {
  getSuperAdminStoreProfileNotifications,
  markSuperAdminStoreProfileNotificationRead,
  markAllSuperAdminStoreProfileNotificationsRead,
} = require("../controllers/superAdminStoreProfileNotificationController");

const superAdminVerify = require("../middleware/authMiddleware");
const uploadStoreImages = require("../middleware/uploadStoreImages");

const router = express.Router();

// Dashboard statistics
router.get("/get-store-stats", superAdminVerify, getStoreStats);

// Get all stores with search, filters and pagination
router.get("/get-all-stores", superAdminVerify, getStores);

// Create a new store
router.post("/create-store", superAdminVerify, uploadStoreImages, createStore);

// Update store active/inactive status
router.patch(
  "/update-store-status/:storeId",
  superAdminVerify,
  updateStoreStatus,
);

// Update store details
router.put(
  "/update-store/:storeId",
  superAdminVerify,
  uploadStoreImages,
  updateStoreDetails,
);

// Get all pending Shop Owner profile-change requests.
router.get(
  "/profile-change-requests",
  superAdminVerify,
  getPendingStoreProfileRequests,
);

// Get one profile-change request with its proposed details.
router.get(
  "/profile-change-requests/:requestId",
  superAdminVerify,
  getStoreProfileRequestById,
);

// Approve a pending store-profile change request.
router.patch(
  "/profile-change-requests/:requestId/approve",
  superAdminVerify,
  approveStoreProfileRequest,
);

// View a pending profile image (Super Admin only).
// Route for the main image or an image without an index.
router.get(
  "/profile-change-requests/:requestId/images/:imageType",
  superAdminVerify,
  getPendingStoreProfileImage,
);

// Route for a gallery image with an index.
router.get(
  "/profile-change-requests/:requestId/images/:imageType/:imageIndex",
  superAdminVerify,
  getPendingStoreProfileImage,
);

// Reject a pending store-profile change request.
router.patch(
  "/profile-change-requests/:requestId/reject",
  superAdminVerify,
  rejectStoreProfileRequest,
);



// Get persistent store-profile notifications for Super Admin.
router.get(
  "/profile-notifications",
  superAdminVerify,
  getSuperAdminStoreProfileNotifications,
);

// Mark one notification as read.
router.patch(
  "/profile-notifications/:notificationId/read",
  superAdminVerify,
  markSuperAdminStoreProfileNotificationRead,
);

// Mark all store-profile notifications as read.
router.patch(
  "/profile-notifications/read-all",
  superAdminVerify,
  markAllSuperAdminStoreProfileNotificationsRead,
);

module.exports = router;
