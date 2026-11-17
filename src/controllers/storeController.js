const mongoose = require("mongoose");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { getStoreImageFilePath } = require("../utils/storeImageUtils");
const Store = require("../models/Store");
const { compressAndSaveImage } = require("../utils/imageUtils");
const uploadRoot = path.resolve("uploads/stores");

const { createSlug, isValidGoogleMapsLink } = require("../utils/storeUtils");

// Validate store details.
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


const validateStoreDetails = (data) => {
  const { name, addressLink, contactNumber, services, weeklyTimings } = data;

  let parsedServices = services;
  let parsedWeeklyTimings = weeklyTimings;

  try {
    if (typeof parsedServices === "string") {
      parsedServices = JSON.parse(parsedServices);
    }

    if (typeof parsedWeeklyTimings === "string") {
      parsedWeeklyTimings = JSON.parse(parsedWeeklyTimings);
    }
  } catch {
    return "Invalid services or weekly timings data.";
  }

  if (
    typeof name !== "string" ||
    typeof addressLink !== "string" ||
    typeof contactNumber !== "string"
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

  if (
    !Array.isArray(parsedServices) ||
    parsedServices.length === 0 ||
    parsedServices.some((service) => !ALLOWED_SERVICES.includes(service)) ||
    new Set(parsedServices).size !== parsedServices.length
  ) {
    return "Select at least one valid store service.";
  }

  if (
    !parsedWeeklyTimings ||
    typeof parsedWeeklyTimings !== "object" ||
    Array.isArray(parsedWeeklyTimings)
  ) {
    return "Please provide the weekly store timings.";
  }

  const timePattern = /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/;

  const toMinutes = (time) => {
    const [clock, period] = time.split(" ");
    const [hours, minutes] = clock.split(":").map(Number);

    const normalizedHours =
      (hours % 12) + (period === "PM" ? 12 : 0);

    return normalizedHours * 60 + minutes;
  };

  for (const day of DAYS) {
    const timing = parsedWeeklyTimings[day];

    if (!timing || typeof timing.isClosed !== "boolean") {
      return `Invalid timing information for ${day}.`;
    }

    if (timing.isClosed) {
      continue;
    }

    if (
      typeof timing.openTime !== "string" ||
      typeof timing.closeTime !== "string" ||
      !timePattern.test(timing.openTime) ||
      !timePattern.test(timing.closeTime)
    ) {
      return `Invalid opening or closing time for ${day}. Use 12-hour format.`;
    }

    if (toMinutes(timing.closeTime) <= toMinutes(timing.openTime)) {
      return `Closing time must be later than opening time for ${day}.`;
    }
  }

  return null;
};


const isContactNumberAlreadyAssigned = async (
  contactNumber,
  excludedStoreId = null,
) => {
  const query = {
    contactNumber: contactNumber.trim(),
  };

  // Exclude the current store when updating its details.
  if (excludedStoreId) {
    query._id = { $ne: excludedStoreId };
  }

  return await Store.exists(query);
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

    const { name, addressLink, contactNumber, timings } = req.body;

    const phoneAlreadyAssigned =
      await isContactNumberAlreadyAssigned(contactNumber);

    if (phoneAlreadyAssigned) {
      console.warn(
        "[Store] Creation rejected: contact number already assigned.",
      );

      return res.status(409).json({
        success: false,
        message: "This contact number is already assigned to another store.",
      });
    }

    const services = JSON.parse(req.body.services);
    const weeklyTimings = JSON.parse(req.body.weeklyTimings);

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
      path.join(storeFolder, mainFileName),
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
        path.join(storeFolder, fileName),
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
      timings: timings?.trim() || "See weekly schedule",
      services,
      weeklyTimings,
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
      await fs
        .rm(storeFolder, {
          recursive: true,
          force: true,
        })
        .catch((cleanupError) => {
          console.error("Store image cleanup error:", cleanupError.message);
        });
    }

        if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This contact number is already assigned to another store.",
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
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const status = req.query.status || "all";
    const service = req.query.service || "all";

    const requestedServices = req.query.services;

    const services =
      requestedServices === undefined
        ? []
        : Array.isArray(requestedServices)
          ? requestedServices
          : [requestedServices];

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

    const allowedServiceFilters = [
      "all",
      "Phone Charging",
      "Pick Me Later",
      "both",
    ];

    if (!allowedServiceFilters.includes(service)) {
      return res.status(400).json({
        success: false,
        message: "Invalid store service filter.",
      });
    }

    if (
      services.length > 2 ||
      services.some(
        (service) =>
          typeof service !== "string" ||
          !["Phone Charging", "Pick Me Later"].includes(service),
      ) ||
      new Set(services).size !== services.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid store services filter.",
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
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
      });
    } else if (status === "inactive") {
      andConditions.push({ isActive: false });
    }

    // Filter stores by selected service.
    if (service === "Phone Charging") {
      andConditions.push({
        services: "Phone Charging",
      });
    } else if (service === "Pick Me Later") {
      andConditions.push({
        services: "Pick Me Later",
      });
    } else if (service === "both") {
      andConditions.push({
        services: {
          $all: ["Phone Charging", "Pick Me Later"],
        },
      });
    }

    // Filter stores by selected services.
    if (services.length > 0) {
      andConditions.push({
        services: { $in: services },
      });
    }

    // Search by store name or contact number.
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const searchRegex = new RegExp(escapedSearch, "i");

      andConditions.push({
        $or: [{ name: searchRegex }, { contactNumber: searchRegex }],
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

      Store.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    const stores = rawStores.map((store) => ({
      ...store,
      isActive: store.isActive !== false,
    }));

    const totalPages = Math.max(1, Math.ceil(totalStores / limit));

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
      { new: true, runValidators: true },
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
    console.error("Update store status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update store status. Please try again.",
    });
  }
};

// UPDATE STORE DETAILS
const updateStoreDetails = async (req, res) => {
  let newMainImagePath = null;
  let newAdditionalImagePaths = [];
  let saveCompleted = false;

  try {
    const { storeId } = req.params;

    // 1. Validate store ID.
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid store ID.",
      });
    }

    // 2. Validate store details.
    const validationError = validateStoreDetails(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const { name, addressLink, contactNumber, timings } = req.body;

    // 3. Parse services.
    const services =
      typeof req.body.services === "string"
        ? JSON.parse(req.body.services)
        : req.body.services;

    // 4. Parse weekly timings.
    const weeklyTimings =
      typeof req.body.weeklyTimings === "string"
        ? JSON.parse(req.body.weeklyTimings)
        : req.body.weeklyTimings;

    // 5. Find existing store.
    const existingStore = await Store.findById(storeId);

    if (!existingStore) {
      return res.status(404).json({
        success: false,
        message: "Store not found.",
      });
    }

    const phoneAlreadyAssigned = await isContactNumberAlreadyAssigned(
      contactNumber,
      existingStore._id,
    );

    if (phoneAlreadyAssigned) {
      console.warn("[Store] Update rejected: contact number already assigned.");

      return res.status(409).json({
        success: false,
        message: "This contact number is already assigned to another store.",
      });
    }

    // 6. Parse existing additional images selected to be retained.
    let requestedExistingImages;

    try {
      requestedExistingImages =
        typeof req.body.existingImages === "string"
          ? JSON.parse(req.body.existingImages)
          : (req.body.existingImages ?? []);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid existing images data.",
      });
    }

    // 7. Validate requested image paths.
    if (
      !Array.isArray(requestedExistingImages) ||
      requestedExistingImages.some(
        (imagePath) => typeof imagePath !== "string",
      ) ||
      new Set(requestedExistingImages).size !== requestedExistingImages.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid existing images selection.",
      });
    }

    // 8. Capture current additional images before modifying the store.
    const currentImages = existingStore.images || [];

    // 9. Identify existing images selected to be retained.
    const retainedImages = currentImages.filter((image) =>
      requestedExistingImages.includes(image.path),
    );

    if (retainedImages.length !== requestedExistingImages.length) {
      return res.status(400).json({
        success: false,
        message: "One or more selected images do not belong to this store.",
      });
    }

    // 10. Get newly uploaded additional images.
    const newAdditionalImageFiles = req.files?.images || [];

    // 11. Enforce maximum four additional images.
    if (retainedImages.length + newAdditionalImageFiles.length > 4) {
      return res.status(400).json({
        success: false,
        message: "A maximum of 4 additional images is allowed.",
      });
    }

    // 12. Identify existing additional images removed by the admin.
    const removedImages = currentImages.filter(
      (image) =>
        !retainedImages.some(
          (retainedImage) => retainedImage.path === image.path,
        ),
    );

    // 13. Update basic store details.
    existingStore.name = name.trim();
    existingStore.addressLink = addressLink.trim();
    existingStore.contactNumber = contactNumber.trim();
    existingStore.timings = timings?.trim() || "See weekly schedule";
    existingStore.services = services;
    existingStore.weeklyTimings = weeklyTimings;

    // 14. Replace main image only when a new image is uploaded.
    const mainImageFile = req.files?.image?.[0];

    let oldMainImagePath = null;

    if (mainImageFile) {
      oldMainImagePath = getStoreImageFilePath(existingStore.image, uploadRoot);

      const targetFolder = oldMainImagePath
        ? path.dirname(oldMainImagePath)
        : path.join(uploadRoot, `${createSlug(name)}-${randomUUID()}`);

      await fs.mkdir(targetFolder, { recursive: true });

      const fileName = `image-${randomUUID()}.webp`;

      newMainImagePath = path.join(targetFolder, fileName);

      await compressAndSaveImage(mainImageFile, newMainImagePath);

      const relativePath = path
        .relative(uploadRoot, newMainImagePath)
        .split(path.sep)
        .join("/");

      existingStore.image = {
        type: "upload",
        path: `/uploads/stores/${relativePath}`,
      };
    }

    // 15. Start with existing additional images selected for retention.
    const updatedImages = [...retainedImages];

    // 16. Determine the folder for additional images.
    const currentMainImagePath = getStoreImageFilePath(
      existingStore.image,
      uploadRoot,
    );

    const currentAdditionalImagePath = currentImages
      .map((image) => getStoreImageFilePath(image, uploadRoot))
      .find(Boolean);

    const targetFolder = currentMainImagePath
      ? path.dirname(currentMainImagePath)
      : currentAdditionalImagePath
        ? path.dirname(currentAdditionalImagePath)
        : path.join(uploadRoot, `${createSlug(name)}-${randomUUID()}`);

    // 17. Create folder if necessary.
    if (newAdditionalImageFiles.length > 0) {
      await fs.mkdir(targetFolder, { recursive: true });
    }

    // 18. Save newly uploaded additional images.
    for (const file of newAdditionalImageFiles) {
      const fileName = `image-${randomUUID()}.webp`;

      const destination = path.join(targetFolder, fileName);

      await compressAndSaveImage(file, destination);

      newAdditionalImagePaths.push(destination);

      const relativePath = path
        .relative(uploadRoot, destination)
        .split(path.sep)
        .join("/");

      updatedImages.push({
        type: "upload",
        path: `/uploads/stores/${relativePath}`,
      });
    }

    // 19. Update additional image references.
    existingStore.images = updatedImages;

    // 20. Save updated store details.
    const updatedStore = await existingStore.save();

    saveCompleted = true;

    // 21. Delete removed additional images after successful database update.
    for (const image of removedImages) {
      const imagePath = getStoreImageFilePath(image, uploadRoot);

      if (imagePath) {
        await fs.unlink(imagePath).catch((cleanupError) => {
          console.error(
            "Removed additional image cleanup error:",
            cleanupError.message,
          );
        });
      }
    }

    // 22. Delete previous main image after successful database update.
    if (oldMainImagePath && oldMainImagePath !== newMainImagePath) {
      await fs.unlink(oldMainImagePath).catch((cleanupError) => {
        console.error("Old main image cleanup error:", cleanupError.message);
      });
    }

    // 23. Send success response.
    return res.status(200).json({
      success: true,
      message: "Store details updated successfully.",
      data: updatedStore,
    });
  } catch (error) {
    // 24. Clean up newly uploaded files if database save did not complete.
    if (!saveCompleted) {
      if (newMainImagePath) {
        await fs.unlink(newMainImagePath).catch((cleanupError) => {
          console.error("New main image cleanup error:", cleanupError.message);
        });
      }

      for (const imagePath of newAdditionalImagePaths) {
        await fs.unlink(imagePath).catch((cleanupError) => {
          console.error(
            "New additional image cleanup error:",
            cleanupError.message,
          );
        });
      }
    }

        if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This contact number is already assigned to another store.",
      });
    }

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
