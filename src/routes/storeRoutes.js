import express from "express";

import {
    createStore,
    getStores,
    getStoreStats,
    updateStoreStatus,
    updateStoreDetails,
} from "../controllers/storeController.js";

import uploadStoreImages from "../middleware/uploadStoreImages.js";

import validateRequest from "../middleware/validateRequest.js";

import {
    createStoreSchema,
    updateStoreStatusSchema,
} from "../validators/storeValidator.js";

import authenticateUser from "../middleware/authMiddleware.js";
import requireStoreCreator from "../middleware/requireStoreCreator.js";

const router = express.Router();

// GET /api/stores/stats - Fetch store summary counts for dashboard
router.get(
    "/stats",
    authenticateUser,
    requireStoreCreator,
    getStoreStats
);

// POST /api/stores
router.post(
    "/",
    authenticateUser,
    requireStoreCreator,
    uploadStoreImages,
    validateRequest(createStoreSchema),
    createStore
);

// GET /api/stores - Fetch paginated/filtered stores
router.get(
    "/",
    authenticateUser,
    requireStoreCreator,
    getStores
);

// PATCH /api/stores/:storeId/status - Update store Active/Inactive status
router.patch(
    "/:storeId/status",
    authenticateUser,
    requireStoreCreator,
    validateRequest(updateStoreStatusSchema),
    updateStoreStatus
);

// PATCH /api/stores/:storeId/details - Update store text details
router.patch(
    "/:storeId/details",
    authenticateUser,
    requireStoreCreator,
    validateRequest(createStoreSchema), // Reusing create schema since text fields are identical
    updateStoreDetails
);

export default router;