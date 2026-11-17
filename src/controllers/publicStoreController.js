
const Store = require("../models/Store");
const mongoose = require("mongoose");


// 1. Get active stores for the Customer app.
const getPublicStores = async (req, res) => {
    try {
        const search =
            typeof req.query.search === "string"
                ? req.query.search.trim()
                : "";

        const service = req.query.service || "all";
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 10);

        // 2. Validate the search and filter parameters.
        if (search.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Search cannot exceed 100 characters.",
            });
        }

        if (
            !["all", "Phone Charging", "Pick Me Later"].includes(service)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid store service filter.",
            });
        }

        if (!Number.isInteger(page) || page < 1) {
            return res.status(400).json({
                success: false,
                message: "Page must be a positive integer.",
            });
        }

        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
            return res.status(400).json({
                success: false,
                message: "Limit must be between 1 and 50.",
            });
        }

        // 3. Show active stores, including legacy stores without a status field.
        const andConditions = [
            {
                $or: [
                    { isActive: true },
                    { isActive: { $exists: false } },
                ],
            },
        ];

        // 4. Filter stores by the selected service.
        if (service !== "all") {
            andConditions.push({
                services: service,
            });
        }

        // 5. Search stores by name.
        if (search) {
            const escapedSearch = search.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            andConditions.push({
                name: new RegExp(escapedSearch, "i"),
            });
        }

        const query = { $and: andConditions };
        const skip = (page - 1) * limit;

        // 6. Fetch store records and total count together.
        const [totalStores, stores] = await Promise.all([
            Store.countDocuments(query),

            Store.find(query)
                .select(
                    "name addressLink timings services weeklyTimings image images createdAt"
                )
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        const totalPages = Math.max(
            1,
            Math.ceil(totalStores / limit)
        );

        // 7. Return the public store listing.
        return res.status(200).json({
            success: true,
            count: stores.length,
            pagination: {
                totalStores,
                totalPages,
                currentPage: page,
                limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
            data: stores,
        });
    } catch (error) {
        console.error(
            "[PublicStores] Store listing failed:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to fetch stores. Please try again.",
        });
    }
};

// 8. Get public details of a single Store.
const getPublicStoreById = async (req, res) => {
    try {
        const { storeId } = req.params;

        // 9. Validate the Store ID.
        if (!mongoose.Types.ObjectId.isValid(storeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid store ID.",
            });
        }

        // 10. Fetch only active Stores, including legacy Stores.
        const store = await Store.findOne({
            _id: storeId,
            $or: [
                { isActive: true },
                { isActive: { $exists: false } },
            ],
        })
            .select(
                "name addressLink timings services weeklyTimings image images createdAt"
            )
            .lean();

        // 11. Return an error if the Store is unavailable.
        if (!store) {
            return res.status(404).json({
                success: false,
                message: "Store not found or currently unavailable.",
            });
        }

        // 12. Return the public Store details.
        return res.status(200).json({
            success: true,
            data: store,
        });
    } catch (error) {
        console.error(
            "[PublicStores] Store details fetch failed:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to fetch Store details. Please try again.",
        });
    }
};

// 13. Export public Store controller functions.
module.exports = {
    getPublicStores,
    getPublicStoreById,
};
