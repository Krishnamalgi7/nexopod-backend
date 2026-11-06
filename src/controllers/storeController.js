
import {
    createStore as createStoreService,
    getStores as getStoresService,
} from "../services/storeService.js";

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
        const stores = await getStoresService();

        return res.status(200).json({
            success: true,
            count: stores.length,
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
