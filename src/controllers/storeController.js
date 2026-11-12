import {
    createStore as createStoreService,
    getStores as getStoresService,
    getStoreStats as getStoreStatsService,
    updateStoreStatus as updateStoreStatusService,
    updateStoreDetails as updateStoreDetailsService,
} from "../services/storeService.js";

import { getStoresQuerySchema } from "../validators/storeValidator.js";

export const createStore = async (req, res) => {
    try {
        const store = await createStoreService(
            req.body,
            req.files
        );

        return res.status(201).json({
            success: true,
            message: "Store created successfully.",
            data: store,
        });
    } catch (error) {
        console.error("Create store controller error:", error.message);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Unable to create store. Please try again.",
        });
    }
};

export const getStores = async (req, res) => {
    try {
        const parsedQuery = getStoresQuerySchema.safeParse(req.query);

        if (!parsedQuery.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid query parameters.",
                errors: parsedQuery.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            });
        }

        const { stores, pagination } = await getStoresService(parsedQuery.data);

        return res.status(200).json({
            success: true,
            count: stores.length,
            pagination,
            data: stores,
        });
    } catch (error) {
        console.error("Get stores controller error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch stores. Please try again.",
        });
    }
};

export const getStoreStats = async (req, res) => {
    try {
        const stats = await getStoreStatsService();

        return res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error("Get store stats controller error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch store statistics.",
        });
    }
};

export const updateStoreStatus = async (req, res) => {
    try {
        const { storeId } = req.params;
        const { isActive } = req.body;

        const updatedStore = await updateStoreStatusService(storeId, isActive);

        return res.status(200).json({
            success: true,
            message: `Store marked as ${isActive ? "Active" : "Inactive"}.`,
            data: updatedStore,
        });
    } catch (error) {
        console.error("Update store status controller error:", error.message);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Unable to update store status. Please try again.",
        });
    }
};

export const updateStoreDetails = async (req, res) => {
    try {
        const { storeId } = req.params;
        const updatedStore = await updateStoreDetailsService(storeId, req.body);

        return res.status(200).json({
            success: true,
            message: "Store details updated successfully.",
            data: updatedStore,
        });
    } catch (error) {
        console.error("Update store details controller error:", error.message);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : "Unable to update store details.",
        });
    }
};