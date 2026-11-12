import Store from "../models/Store.js";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

const uploadRoot = path.resolve("uploads/stores");

class StoreServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Convert the store name into a safe folder-name prefix.
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

// Compress an uploaded photo and save it as WebP.
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

export const createStore = async (storeData, files = {}) => {
  const { name, addressLink, contactNumber, timings } = storeData;

  const mainImageFile = files.image?.[0] || null;
  const additionalImageFiles = files.images || [];

  // Main image is mandatory.
  if (!mainImageFile) {
    throw new StoreServiceError("Please upload a main store image.");
  }

  // Maximum 4 additional images.
  if (additionalImageFiles.length > 4) {
    throw new StoreServiceError("A maximum of 4 additional images is allowed.");
  }

  const folderName = `${createSlug(name)}-${randomUUID()}`;
  const storeFolder = path.join(uploadRoot, folderName);

  let folderCreated = false;

  try {
    await fs.mkdir(storeFolder, { recursive: true });
    folderCreated = true;

    // Save the main image.

    // Save the mandatory main image.
    const mainFileName = "image.webp";

    await compressAndSaveImage(
      mainImageFile,
      path.join(storeFolder, mainFileName),
    );

    const mainImage = {
      type: "upload",
      path: `/uploads/stores/${folderName}/${mainFileName}`,
    };

    // Save additional uploaded images.
    const uploadedImages = [];

    for (let index = 0; index < additionalImageFiles.length; index++) {
      const fileName = `image-${index + 1}.webp`;

      await compressAndSaveImage(
        additionalImageFiles[index],
        path.join(storeFolder, fileName),
      );

      uploadedImages.push({
        type: "upload",
        path: `/uploads/stores/${folderName}/${fileName}`,
      });
    }

    const store = await Store.create({
      name,
      addressLink,
      contactNumber,
      timings,
      image: mainImage,
      images: uploadedImages
    });

    console.log("Store created successfully:", store._id);

    return store;
  } catch (error) {
    // Remove uploaded files if image processing or DB creation fails.
    if (folderCreated) {
      await fs
        .rm(storeFolder, {
          recursive: true,
          force: true,
        })
        .catch((cleanupError) => {
          console.error(
            "Failed to clean up store image folder:",
            cleanupError.message,
          );
        });
    }

    console.error("Store creation failed:", error.message);
    throw error;
  }
};


// Escape special regex characters to prevent regex injection from search input.
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const getStores = async ({
  search = "",
  status = "all",
  page = 1,
  limit = 10,
} = {}) => {
  try {
    const query = {};
    const andConditions = [];

    // 1. Status filter (treats legacy documents without isActive as active)
    if (status === "active") {
      andConditions.push({
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
      });
    } else if (status === "inactive") {
      andConditions.push({ isActive: false });
    }

    // 2. Search filter (matches store name or contact number)
    if (search) {
      const safeSearchRegex = new RegExp(escapeRegex(search), "i");
      andConditions.push({
        $or: [
          { name: safeSearchRegex },
          { contactNumber: safeSearchRegex },
        ],
      });
    }

    if (andConditions.length === 1) {
      Object.assign(query, andConditions[0]);
    } else if (andConditions.length > 1) {
      query.$and = andConditions;
    }

    const skip = (page - 1) * limit;

    // Run count and paginated fetch in parallel for better performance
    const [totalStores, rawStores] = await Promise.all([
      Store.countDocuments(query),
      Store.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // Ensure every returned store explicitly has boolean isActive
    const stores = rawStores.map((store) => ({
      ...store,
      isActive: store.isActive !== false,
    }));

    const totalPages = Math.max(1, Math.ceil(totalStores / limit));

    return {
      stores,
      pagination: {
        totalStores,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    console.error("Fetch stores service error:", error.message);
    throw error;
  }
};

export const getStoreStats = async () => {
  try {
    const [totalStores, inactiveStores] = await Promise.all([
      Store.countDocuments(),
      Store.countDocuments({ isActive: false }),
    ]);

    const activeStores = totalStores - inactiveStores;

    return {
      totalStores,
      activeStores,
      inactiveStores,
    };
  } catch (error) {
    console.error("Fetch store stats service error:", error.message);
    throw error;
  }
};

export const updateStoreStatus = async (storeId, isActive) => {
  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    throw new StoreServiceError("Invalid store ID.", 400);
  }

  const updatedStore = await Store.findByIdAndUpdate(
    storeId,
    { $set: { isActive } },
    { new: true, runValidators: true }
  ).lean();

  if (!updatedStore) {
    throw new StoreServiceError("Store not found.", 404);
  }

  return updatedStore;
};

export const updateStoreDetails = async (storeId, updateData) => {
  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    throw new StoreServiceError("Invalid store ID.", 400);
  }

  const updatedStore = await Store.findByIdAndUpdate(
    storeId,
    { 
      $set: { 
        name: updateData.name, 
        addressLink: updateData.addressLink, 
        contactNumber: updateData.contactNumber,
        timings: updateData.timings 
      } 
    },
    { new: true, runValidators: true }
  ).lean();

  if (!updatedStore) {
    throw new StoreServiceError("Store not found.", 404);
  }

  return updatedStore;
};