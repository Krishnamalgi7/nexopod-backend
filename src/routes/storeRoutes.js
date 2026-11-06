
import express from "express";

import {
    createStore,
    getStores,
} from "../controllers/storeController.js";

import uploadStoreImages from "../middleware/uploadStoreImages.js";

import validateRequest from "../middleware/validateRequest.js";

import {
    createStoreSchema,
} from "../validators/storeValidator.js";

import authenticateUser from "../middleware/authMiddleware.js";
import requireStoreCreator from "../middleware/requireStoreCreator.js";

const router = express.Router();

// POST /api/stores

router.post(
    "/",
    authenticateUser,
    requireStoreCreator,
    uploadStoreImages,
    validateRequest(createStoreSchema),
    createStore
);

// GET /api/stores - Fetch all stores
router.get(
    "/",
    authenticateUser,
    requireStoreCreator,
    getStores
);

export default router;
