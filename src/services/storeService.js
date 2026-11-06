import Store from "../models/Store.js";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

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
  const { name, addressLink, contactNumber } = storeData;

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


export const getStores = async () => {
    try {
        const stores = await Store.find()
            .sort({ createdAt: -1 })
            .lean();

        return stores;
    } catch (error) {
        console.error("Fetch stores service error:", error.message);
        throw error;
    }
};
