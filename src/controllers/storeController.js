
const mongoose = require("mongoose");
const sharp = require("sharp");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const Store = require("../models/Store");

const uploadRoot = path.resolve("uploads/stores");

// Convert store name into a safe folder name.
const createSlug = (name) => {
    return (
        name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 50) || "store"
    );
};

// Validate Google Maps URL.
const isValidGoogleMapsLink = (value) => {
    try {
        const url = new URL(value);
        const hostname = url.hostname.toLowerCase();

        const allowedDomains = [
            "maps.app.goo.gl",
            "goo.gl",
            "maps.google.com",
            "google.com",
            "google.co.in",
        ];

        const isGoogleMapsDomain = allowedDomains.some(
            (domain) =>
                hostname === domain ||
                hostname.endsWith("." + domain)
        );

        return (
            ["http:", "https:"].includes(url.protocol) &&
            isGoogleMapsDomain
        );
    } catch {
        return false;
    }
};

// Validate store details.
const validateStoreDetails = (data) => {
    const { name, addressLink, contactNumber, timings } = data;

    if (
        typeof name !== "string" ||
        typeof addressLink !== "string" ||
        typeof contactNumber !== "string" ||
        typeof timings !== "string"
    ) {
        return "All store details are required.";
    }

    if (name.trim().length < 2 || name.trim().length > 100) {
        return "Store name must contain between 2 and 100 characters.";
    }

    if (!isValidGoogleMapsLink(addressLink.trim())) {
        return "Please provide a valid Google Maps link.";
    }

    if (!/^[0-9]{10}$/.test(contactNumber.trim())) {
        return "Contact number must contain exactly 10 digits.";
    }

    if (timings.trim().length < 2 || timings.trim().length > 100) {
        return "Timings must contain between 2 and 100 characters.";
    }

    return null;
};

// Compress and save image as WebP.
const compressAndSaveImage = async (file, destination) => {
    const compressedBuffer = await sharp(file.buffer, {
        limitInputPixels: 40_000_000,
    })
        .rotate()
        .resize({
            width: 1600,
            height: 1200,
            fit: "inside",
            withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

    await fs.writeFile(destination, compressedBuffer);
};


// CREATE STORE
const createStore = async (req, res) => {
    let storeFolder;
    let folderCreated = false;

    try {
        const validationError = validateStoreDetails(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError,
            });
        }

        const {
            name,
            addressLink,
            contactNumber,
            timings,
        } = req.body;

        const mainImageFile = req.files?.image?.[0];
        const additionalImageFiles = req.files?.images || [];

        if (!mainImageFile) {
            return res.status(400).json({
                success: false,
                message: "Please upload a main store image.",
            });
        }

        if (additionalImageFiles.length > 4) {
            return res.status(400).json({
                success: false,
                message: "A maximum of 4 additional images is allowed.",
            });
        }

        const folderName = `${createSlug(name)}-${randomUUID()}`;

        storeFolder = path.join(uploadRoot, folderName);

        await fs.mkdir(storeFolder, { recursive: true });
        folderCreated = true;

        // Save main image.
        const mainFileName = "image.webp";

        await compressAndSaveImage(
            mainImageFile,
            path.join(storeFolder, mainFileName)
        );

        const mainImage = {
            type: "upload",
            path: `/uploads/stores/${folderName}/${mainFileName}`,
        };

        // Save additional images.
        const uploadedImages = [];

        for (let index = 0; index < additionalImageFiles.length; index++) {
            const fileName = `image-${index + 1}.webp`;

            await compressAndSaveImage(
                additionalImageFiles[index],
                path.join(storeFolder, fileName)
            );

            uploadedImages.push({
                type: "upload",
                path: `/uploads/stores/${folderName}/${fileName}`,
            });
        }

        const store = await Store.create({
            name: name.trim(),
            addressLink: addressLink.trim(),
            contactNumber: contactNumber.trim(),
            timings: timings.trim(),
            image: mainImage,
            images: uploadedImages,
        });

        return res.status(201).json({
            success: true,
            message: "Store created successfully.",
            data: store,
        });

    } catch (error) {
        // Clean up uploaded files if creation fails.
        if (folderCreated && storeFolder) {
            await fs.rm(storeFolder, {
                recursive: true,
                force: true,
            }).catch((cleanupError) => {
                console.error(
                    "Store image cleanup error:",
                    cleanupError.message
                );
            });
        }

        console.error("Create store error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to create store. Please try again.",
        });
    }
};


// GET ALL STORES
const getStores = async (req, res) => {
    try {
        const search =
            typeof req.query.search === "string"
                ? req.query.search.trim()
                : "";

        const status = req.query.status || "all";

        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 10);

        if (search.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Search cannot exceed 100 characters.",
            });
        }

        if (!["all", "active", "inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid store status filter.",
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

        const query = {};
        const andConditions = [];

        // Active filter includes legacy stores without isActive.
        if (status === "active") {
            andConditions.push({
                $or: [
                    { isActive: true },
                    { isActive: { $exists: false } },
                ],
            });
        } else if (status === "inactive") {
            andConditions.push({ isActive: false });
        }

        // Search by store name or contact number.
        if (search) {
            const escapedSearch = search.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            const searchRegex = new RegExp(escapedSearch, "i");

            andConditions.push({
                $or: [
                    { name: searchRegex },
                    { contactNumber: searchRegex },
                ],
            });
        }

        if (andConditions.length === 1) {
            Object.assign(query, andConditions[0]);
        } else if (andConditions.length > 1) {
            query.$and = andConditions;
        }

        const skip = (page - 1) * limit;

        const [totalStores, rawStores] = await Promise.all([
            Store.countDocuments(query),

            Store.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        const stores = rawStores.map((store) => ({
            ...store,
            isActive: store.isActive !== false,
        }));

        const totalPages = Math.max(
            1,
            Math.ceil(totalStores / limit)
        );

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
        console.error("Get stores error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch stores. Please try again.",
        });
    }
};


// GET STORE STATISTICS
const getStoreStats = async (req, res) => {
    try {
        const [totalStores, inactiveStores] = await Promise.all([
            Store.countDocuments(),
            Store.countDocuments({ isActive: false }),
        ]);

        const activeStores = totalStores - inactiveStores;

        return res.status(200).json({
            success: true,
            data: {
                totalStores,
                activeStores,
                inactiveStores,
            },
        });

    } catch (error) {
        console.error("Get store stats error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch store statistics.",
        });
    }
};


// UPDATE STORE STATUS
const updateStoreStatus = async (req, res) => {
    try {
        const { storeId } = req.params;
        const { isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(storeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid store ID.",
            });
        }

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Store status must be true or false.",
            });
        }

        const updatedStore = await Store.findByIdAndUpdate(
            storeId,
            { $set: { isActive } },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedStore) {
            return res.status(404).json({
                success: false,
                message: "Store not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: `Store marked as ${isActive ? "Active" : "Inactive"}.`,
            data: updatedStore,
        });

    } catch (error) {
        console.error("Update store status error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update store status. Please try again.",
        });
    }
};


// UPDATE STORE DETAILS
const updateStoreDetails = async (req, res) => {
    try {
        const { storeId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(storeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid store ID.",
            });
        }

        const validationError = validateStoreDetails(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError,
            });
        }

        const {
            name,
            addressLink,
            contactNumber,
            timings,
        } = req.body;

        const updatedStore = await Store.findByIdAndUpdate(
            storeId,
            {
                $set: {
                    name: name.trim(),
                    addressLink: addressLink.trim(),
                    contactNumber: contactNumber.trim(),
                    timings: timings.trim(),
                },
            },
            {
                new: true,
                runValidators: true,
            }
        ).lean();

        if (!updatedStore) {
            return res.status(404).json({
                success: false,
                message: "Store not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Store details updated successfully.",
            data: updatedStore,
        });

    } catch (error) {
        console.error("Update store details error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update store details.",
        });
    }
};


module.exports = {
    createStore,
    getStores,
    getStoreStats,
    updateStoreStatus,
    updateStoreDetails,
};
