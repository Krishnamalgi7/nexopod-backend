const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const Store = require("../models/Store");
const SuperAdmin = require("../models/SuperAdmin");
const StoreProfileChangeRequest = require("../models/StoreProfileChangeRequest");
const StoreProfileNotification = require("../models/StoreProfileNotification");

const { compressAndSaveImage } = require("../utils/imageUtils");
const { isValidGoogleMapsLink } = require("../utils/storeUtils");
const { getIO } = require("../config/socket");

const pendingRoot = path.resolve("private-uploads/pending-store-profile");

const cleanupPendingFiles = async (savedFiles, targetFolder) => {
  for (const filePath of savedFiles) {
    await fs.unlink(filePath).catch((error) => {
      if (error.code !== "ENOENT") {
        console.error(
          "[StoreProfileChange] File cleanup failed:",
          error.message,
        );
      }
    });
  }

  if (targetFolder) {
    await fs
      .rm(targetFolder, {
        recursive: true,
        force: true,
      })
      .catch((error) => {
        console.error(
          "[StoreProfileChange] Folder cleanup failed:",
          error.message,
        );
      });
  }
};

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const ALLOWED_SERVICES = ["Phone Charging", "Pick Me Later"];

const parseJsonField = (value, fallback, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`Invalid ${fieldName} data.`);
    }
  }

  return value;
};

const submitStoreProfileChange = async (req, res) => {
  const savedFiles = [];
  let targetFolder;
  let changeRequest = null;

  try {
    const storeId = req.store._id;

    // Fetch the complete approved profile.
    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found.",
      });
    }

    // Do not allow multiple pending requests for one store.
    const pendingRequest = await StoreProfileChangeRequest.findOne({
      storeId,
      status: "pending",
    });

    if (pendingRequest) {
      return res.status(409).json({
        success: false,
        message:
          "You already have a store profile change request pending approval.",
      });
    }

    const body = req.body || {};

    let services;
    let weeklyTimings;
    let existingImages;

    try {
      services = parseJsonField(
        body.services,
        store.services || [],
        "services",
      );

      weeklyTimings = parseJsonField(
        body.weeklyTimings,
        store.weeklyTimings?.toObject?.() || store.weeklyTimings || {},
        "weekly timings",
      );

      existingImages = parseJsonField(
        body.existingImages,
        (store.images || []).map((item) => item.path),
        "additional images",
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const name = typeof body.name === "string" ? body.name.trim() : store.name;

    const addressLink =
      typeof body.addressLink === "string"
        ? body.addressLink.trim()
        : store.addressLink;

    const contactNumber =
      typeof body.contactNumber === "string"
        ? body.contactNumber.trim()
        : store.contactNumber;

    const timings =
      typeof body.timings === "string" ? body.timings.trim() : store.timings;

    // Validate the store's text fields.
    if (typeof name !== "string" || name.length < 2 || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Store name must contain between 2 and 100 characters.",
      });
    }

    if (!isValidGoogleMapsLink(addressLink)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid Google Maps link.",
      });
    }

    if (!/^[0-9]{10}$/.test(contactNumber)) {
      return res.status(400).json({
        success: false,
        message: "Contact number must contain exactly 10 digits.",
      });
    }

    if (
      typeof timings !== "string" ||
      timings.trim().length < 2 ||
      timings.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Store timings must contain between 2 and 100 characters.",
      });
    }

    if (
      !Array.isArray(services) ||
      services.some((service) => !ALLOWED_SERVICES.includes(service)) ||
      new Set(services).size !== services.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid store services.",
      });
    }

    if (
      !weeklyTimings ||
      typeof weeklyTimings !== "object" ||
      Array.isArray(weeklyTimings)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid weekly timings.",
      });
    }

    for (const day of DAYS) {
      const dayTiming = weeklyTimings[day];

      if (!dayTiming || typeof dayTiming !== "object") {
        return res.status(400).json({
          success: false,
          message: `Timings are required for ${day}.`,
        });
      }

      if (typeof dayTiming.isClosed !== "boolean") {
        return res.status(400).json({
          success: false,
          message: `Invalid closed status for ${day}.`,
        });
      }

      if (!dayTiming.isClosed) {
        const timePattern = /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/;

        if (
          !timePattern.test(dayTiming.openTime || "") ||
          !timePattern.test(dayTiming.closeTime || "")
        ) {
          return res.status(400).json({
            success: false,
            message: `Valid opening and closing times are required for ${day}.`,
          });
        }
      }
    }

    // Validate retained gallery images.
    if (
      !Array.isArray(existingImages) ||
      existingImages.some((item) => typeof item !== "string") ||
      new Set(existingImages).size !== existingImages.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid additional image selection.",
      });
    }

    const currentImages = store.images || [];

    const retainedImages = currentImages.filter((image) =>
      existingImages.includes(image.path),
    );

    if (retainedImages.length !== existingImages.length) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected additional images do not belong to this store.",
      });
    }

    const mainImagePath =
      typeof body.mainImagePath === "string"
        ? body.mainImagePath
        : store.image?.path;

    const mainImageFile = req.files?.image?.[0];
    const additionalImageFiles = req.files?.images || [];

    const isExistingMainImage =
      store.image?.type === "upload" && store.image.path === mainImagePath;

    if (!mainImageFile && !isExistingMainImage) {
      return res.status(400).json({
        success: false,
        message: "A main store image is required.",
      });
    }

    if (retainedImages.length + additionalImageFiles.length > 4) {
      return res.status(400).json({
        success: false,
        message: "A maximum of 4 additional images is allowed.",
      });
    }

    // Store newly uploaded proposed images in a separate pending folder.
    const requestFolderId = randomUUID();

    targetFolder = path.join(pendingRoot, storeId.toString(), requestFolderId);

    await fs.mkdir(targetFolder, { recursive: true });

    let proposedImage;

    if (mainImageFile) {
      const destination = path.join(targetFolder, `main-${randomUUID()}.webp`);

      await compressAndSaveImage(mainImageFile, destination);
      savedFiles.push(destination);

      proposedImage = {
        type: "upload",
        path: `/private/pending-store-profile/${storeId}/${requestFolderId}/${path.basename(destination)}`,
      };
    } else {
      proposedImage = {
        type: "upload",
        path: store.image.path,
      };
    }

    const proposedImages = [...retainedImages];

    for (const file of additionalImageFiles) {
      const destination = path.join(
        targetFolder,
        `gallery-${randomUUID()}.webp`,
      );

      await compressAndSaveImage(file, destination);
      savedFiles.push(destination);

      proposedImages.push({
        type: "upload",
        path: `/private/pending-store-profile/${storeId}/${requestFolderId}/${path.basename(destination)}`,
      });
    }

    // Complete proposed profile snapshot.
    const proposedProfile = {
      name,
      addressLink,
      contactNumber,
      timings,
      services,
      weeklyTimings,
      image: proposedImage,
      images: proposedImages,
    };

    // Validate the proposed snapshot against the actual Store schema.
    const validationStore = new Store({
      ...store.toObject(),
      ...proposedProfile,
    });

    const validationError = validationStore.validateSync();

    if (validationError) {

      await cleanupPendingFiles(savedFiles, targetFolder);

      return res.status(400).json({
        success: false,
        message: validationError.message,
      });
    }

    changeRequest = await StoreProfileChangeRequest.create({
      storeId,
      proposedProfile,
    });

    // Persist a notification for the Super Admin.
    // Submission must not succeed if this notification cannot be saved.
    const superAdmin = await SuperAdmin.findOne().select("_id");

    await StoreProfileNotification.create({
      storeId,
      requestId: changeRequest._id,
      recipientRole: "superAdmin",
      recipientId: superAdmin?._id || null,
      type: "store_profile_submitted",
      title: "Store profile update request",
      message: `${store.name} has submitted store profile changes for verification.`,
    });

    // Notify connected Super Admins in real time.
    try {
      getIO().to("super-admin").emit("store_profile_change_requested", {
        requestId: changeRequest._id,
        storeId,
        storeName: store.name,
        status: changeRequest.status,
        submittedAt: changeRequest.createdAt,
      });
    } catch (socketError) {
      console.error(
        "[Socket] Store profile request notification failed:",
        socketError.message,
      );
    }

    return res.status(201).json({
      success: true,
      message: "Store profile changes submitted for verification.",
      data: {
        requestId: changeRequest._id,
        status: changeRequest.status,
        submittedAt: changeRequest.createdAt,
      },
    });
  } catch (error) {
  // Remove the pending request if its submission failed.
  if (changeRequest?._id) {
    await StoreProfileChangeRequest.deleteOne({
      _id: changeRequest._id,
      status: "pending",
    }).catch((cleanupError) => {
      console.error(
        "[StoreProfileChange] Request cleanup failed:",
        cleanupError.message,
      );
    });
  }

  // Clean up newly created files if submission fails.
  await cleanupPendingFiles(savedFiles, targetFolder);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A store profile change request is already pending approval.",
      });
    }

    console.error("[StoreProfileChange] Submission failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to submit store profile changes.",
    });
  }
};

// Get the authenticated Shop Owner's latest profile-change request.
const getMyStoreProfileChangeRequest = async (req, res) => {
  try {
    const request = await StoreProfileChangeRequest.findOne({
      storeId: req.store._id,
    })
      .select("status rejectionReason createdAt reviewedAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Store profile request status fetched successfully.",
      data: { request },
    });
  } catch (error) {
    console.error(
      "[StoreProfileChange] Request status fetch failed:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch store profile request status.",
    });
  }
};

module.exports = {
  submitStoreProfileChange,
  getMyStoreProfileChangeRequest,
};
