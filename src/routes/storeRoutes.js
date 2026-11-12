
const express = require("express");

const {
    createStore,
    getStores,
    getStoreStats,
    updateStoreStatus,
    updateStoreDetails,
} = require("../controllers/storeController");

const superAdminVerify = require("../middleware/authMiddleware");
const uploadStoreImages = require("../middleware/uploadStoreImages");

const router = express.Router();

// Dashboard statistics
router.get(
    "/get-store-stats",
    superAdminVerify,
    getStoreStats
);

// Get all stores with search, filters and pagination
router.get(
    "/get-all-stores",
    superAdminVerify,
    getStores
);

// Create a new store
router.post(
    "/create-store",
    superAdminVerify,
    uploadStoreImages,
    createStore
);

// Update store active/inactive status
router.patch(
    "/update-store-status/:storeId",
    superAdminVerify,
    updateStoreStatus
);

// Update store details
router.put(
    "/update-store/:storeId",
    superAdminVerify,
    updateStoreDetails
);

module.exports = router;
