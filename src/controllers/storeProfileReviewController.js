const mongoose = require("mongoose");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const StoreProfileChangeRequest = require("../models/StoreProfileChangeRequest");
const StoreProfileNotification = require("../models/StoreProfileNotification");
const Store = require("../models/Store");

const { getIO } = require("../config/socket");

const pendingRoot = path.resolve("private-uploads/pending-store-profile");
const permanentRoot = path.resolve("uploads/stores");

const PENDING_URL_PREFIX = "/private/pending-store-profile/";
const PERMANENT_URL_PREFIX = "/uploads/stores/";

// Resolve a pending image path safely.
const getPendingFilePath = (imagePath) => {
  if (
    typeof imagePath !== "string" ||
    !imagePath.startsWith(PENDING_URL_PREFIX)
  ) {
    return null;
  }

  const relativePath = imagePath.slice(PENDING_URL_PREFIX.length);
  const absolutePath = path.resolve(pendingRoot, relativePath);

  if (!absolutePath.startsWith(`${pendingRoot}${path.sep}`)) {
    return null;
  }

  return absolutePath;
};

// Promote newly uploaded images into the permanent store folder.
// Existing approved images are left unchanged.
const promoteImage = async (image, storeId, movedFiles) => {
  if (!image || image.type !== "upload") {
    throw new Error("Invalid store image.");
  }

  const sourcePath = getPendingFilePath(image.path);

  if (!sourcePath) {
    return image;
  }

  await fs.access(sourcePath);

  const destinationFolder = path.join(permanentRoot, storeId.toString());

  await fs.mkdir(destinationFolder, { recursive: true });

  const filename = `profile-${randomUUID()}.webp`;
  const destinationPath = path.join(destinationFolder, filename);

  await fs.rename(sourcePath, destinationPath);

  movedFiles.push({
    sourcePath,
    destinationPath,
  });

  return {
    type: "upload",
    path: `${PERMANENT_URL_PREFIX}${storeId}/${filename}`,
  };
};

// Restore promoted files and report any failures to the caller.
const restorePromotedFiles = async (movedFiles) => {
  const failures = [];

  for (const file of [...movedFiles].reverse()) {
    try {
      await fs.mkdir(path.dirname(file.sourcePath), {
        recursive: true,
      });

      await fs.rename(file.destinationPath, file.sourcePath);
    } catch (error) {
      failures.push({
        file: file.destinationPath,
        message: error.message,
      });

      console.error(
        "[Store Profile Review] Image rollback failed:",
        error.message,
      );
    }
  }

  return failures;
};

// Delete only images belonging to the pending request.
const deletePendingImages = async (proposedProfile) => {
  const images = [
    proposedProfile?.image,
    ...(Array.isArray(proposedProfile?.images) ? proposedProfile.images : []),
  ];

  const folders = new Set();

  for (const image of images) {
    const filePath = getPendingFilePath(image?.path);

    if (!filePath) continue;

    await fs.unlink(filePath).catch((error) => {
      if (error.code !== "ENOENT") {
        console.error(
          "[Store Profile Review] Pending image cleanup failed:",
          error.message,
        );
      }
    });

    folders.add(path.dirname(filePath));
  }

  for (const folder of folders) {
    await fs
      .rm(folder, {
        recursive: true,
        force: true,
      })
      .catch((error) => {
        console.error(
          "[Store Profile Review] Pending folder cleanup failed:",
          error.message,
        );
      });
  }
};

// Create a persistent Shop Owner decision notification.
const notifyShopOwner = async ({
  storeId,
  requestId,
  type,
  title,
  message,
}) => {
  await StoreProfileNotification.create({
    storeId,
    requestId,
    recipientRole: "shopOwner",
    recipientId: null,
    type,
    title,
    message,
  });

  try {
    getIO()
      .to(`store:${storeId}`)
      .emit("store_profile_change_decision", {
        requestId,
        status: type === "store_profile_approved" ? "approved" : "rejected",
        title,
        message,
      });
  } catch (error) {
    console.error(
      "[Socket] Shop Owner decision notification failed:",
      error.message,
    );
  }
};

// Get store-profile requests with status filters, search and pagination.
const getPendingStoreProfileRequests = async (req, res) => {
  try {
    const {
      status = "all",
      search = "",
      page = 1,
      limit = 10,
    } = req.query;

    const allowedStatuses = ["all", "pending", "approved", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request status.",
      });
    }

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number.parseInt(limit, 10) || 10)
    );

    const filter = {};

    if (status !== "all") {
      filter.status = status;
    }

    const searchTerm = search.trim();

    if (searchTerm) {
      const escapedSearch = searchTerm.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const matchingStores = await Store.find({
        name: { $regex: escapedSearch, $options: "i" },
      }).distinct("_id");

      const searchConditions = [
        { storeId: { $in: matchingStores } },
      ];

      if (mongoose.isValidObjectId(searchTerm)) {
        searchConditions.push(
          { _id: new mongoose.Types.ObjectId(searchTerm) },
          { storeId: new mongoose.Types.ObjectId(searchTerm) }
        );
      }

      filter.$or = searchConditions;
    }

    const [requests, total, statusCounts] = await Promise.all([
      StoreProfileChangeRequest.find(filter)
        .populate(
          "storeId",
          "name contactNumber image isActive"
        )
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .lean(),

      StoreProfileChangeRequest.countDocuments(filter),

      Promise.all(
        allowedStatuses
          .filter((item) => item !== "all")
          .map(async (item) => ({
            [item]: await StoreProfileChangeRequest.countDocuments({
              status: item,
            }),
          }))
      ),
    ]);

    const counts = Object.assign({}, ...statusCounts);

    return res.status(200).json({
      success: true,
      message: "Store-profile requests fetched successfully.",
      data: {
        requests,
        total,
        page: currentPage,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
        statusCounts: {
          all: counts.pending + counts.approved + counts.rejected,
          ...counts,
        },
      },
    });
  } catch (error) {
    console.error(
      "[Store Profile Review] Fetch requests failed:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch store-profile requests.",
    });
  }
};


// Get one request with its proposed details.
const getStoreProfileRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;

    if (!mongoose.isValidObjectId(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const request = await StoreProfileChangeRequest.findById(requestId)
  .populate(
    "storeId",
    "name contactNumber addressLink timings services weeklyTimings image images isActive",
  )
  .lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Store-profile change request not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Store-profile request fetched successfully.",
      data: { request },
    });
  } catch (error) {
    console.error(
      "[Store Profile Review] Fetch request failed:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch the store-profile request.",
    });
  }
};

// Serve a pending profile image only to an authenticated Super Admin.
const getPendingStoreProfileImage = async (req, res) => {
  try {
    const { requestId, imageType, imageIndex } = req.params;

    if (!mongoose.isValidObjectId(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const request = await StoreProfileChangeRequest.findById(requestId)
      .select("proposedProfile status")
      .lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Store-profile change request not found.",
      });
    }

    let image;

    if (imageType === "main") {
      image = request.proposedProfile?.image;
    } else if (imageType === "gallery") {
      const index = Number(imageIndex);

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= (request.proposedProfile?.images || []).length
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid gallery image index.",
        });
      }

      image = request.proposedProfile.images[index];
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid image type.",
      });
    }

    const filePath = getPendingFilePath(image?.path);

    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: "Pending image not found.",
      });
    }

    await fs.access(filePath);

    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "image/webp");

    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        return res.status(404).json({
          success: false,
          message: "Unable to load pending image.",
        });
      }
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({
        success: false,
        message: "Pending image not found.",
      });
    }

    console.error(
      "[Store Profile Review] Pending image fetch failed:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load pending image.",
    });
  }
};

// Approve a pending profile-change request.
const approveStoreProfileRequest = async (req, res) => {
  const movedFiles = [];

  try {
    const { requestId } = req.params;

    if (!mongoose.isValidObjectId(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const request = await StoreProfileChangeRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Store-profile change request not found.",
      });
    }

    if (request.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "This request has already been reviewed.",
      });
    }

    const store = await Store.findById(request.storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "The associated store was not found.",
      });
    }

    // Keep the currently approved profile so it can be restored on failure.
    const previousProfile = {
      name: store.name,
      addressLink: store.addressLink,
      contactNumber: store.contactNumber,
      timings: store.timings,
      services: [...(store.services || [])],
      weeklyTimings: store.weeklyTimings?.toObject?.() || store.weeklyTimings,
      image: store.image?.toObject?.() || store.image,
      images: (store.images || []).map((image) => image.toObject?.() || image),
    };

    let storeUpdated = false;

    // Atomically claim the pending request so it cannot be
    // approved or rejected simultaneously by another action.
    const claimedRequest = await StoreProfileChangeRequest.findOneAndUpdate(
      {
        _id: requestId,
        status: "pending",
      },
      {
        $set: {
          status: "approved",
          reviewedBy: req.superAdmin._id,
          reviewedAt: new Date(),
        },
      },
      {
        new: true,
      },
    );

    if (!claimedRequest) {
      return res.status(409).json({
        success: false,
        message: "This request has already been reviewed.",
      });
    }

    try {
      const proposedProfile = {
        ...request.proposedProfile,
      };

      proposedProfile.image = await promoteImage(
        proposedProfile.image,
        store._id,
        movedFiles,
      );

      const proposedImages = [];

      for (const image of proposedProfile.images || []) {
        proposedImages.push(await promoteImage(image, store._id, movedFiles));
      }

      proposedProfile.images = proposedImages;

      // Apply the complete approved profile snapshot.
      store.set(proposedProfile);

      await store.save();
      storeUpdated = true;

      claimedRequest.proposedProfile = proposedProfile;
      await claimedRequest.save();

      await notifyShopOwner({
        storeId: store._id,
        requestId: request._id,
        type: "store_profile_approved",
        title: "Store profile changes approved",
        message:
          "Your store profile changes have been approved and are now active.",
      });

      // Clean up pending files only after approval and notification succeed.
      await deletePendingImages(request.proposedProfile);

      return res.status(200).json({
        success: true,
        message: "Store profile changes approved successfully.",
        data: {
          requestId: claimedRequest._id,
          status: claimedRequest.status,
        },
      });
    } catch (error) {
      const rollbackFailures = [];

      // Restore promoted images and collect any failures.
      const imageRollbackFailures = await restorePromotedFiles(movedFiles);
      rollbackFailures.push(...imageRollbackFailures);

      // Restore the previously approved Store profile.
      if (storeUpdated) {
        try {
          store.set(previousProfile);
          await store.save();
        } catch (rollbackError) {
          rollbackFailures.push({
            operation: "Store profile rollback",
            message: rollbackError.message,
          });

          console.error(
            "[Store Profile Review] Store rollback failed:",
            rollbackError.message,
          );
        }
      }

      // Reset the request only when every rollback operation succeeded.
      if (rollbackFailures.length === 0) {
        const resetResult = await StoreProfileChangeRequest.updateOne(
          {
            _id: requestId,
            status: "approved",
            reviewedBy: req.superAdmin._id,
          },
          {
            $set: {
              status: "pending",
              reviewedBy: null,
              reviewedAt: null,
              proposedProfile: request.proposedProfile,
            },
          },
        );

        if (resetResult.modifiedCount !== 1) {
          console.error(
            "[Store Profile Review] Request could not be reset to pending.",
          );
        }
      } else {
        console.error(
          "[Store Profile Review] Rollback incomplete. Request remains locked for manual recovery:",
          rollbackFailures,
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("[Store Profile Review] Approval failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to approve the store profile changes.",
    });
  }
};

// Reject a pending profile-change request.
const rejectStoreProfileRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    if (!mongoose.isValidObjectId(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    if (reason.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason cannot exceed 500 characters.",
      });
    }

    const request = await StoreProfileChangeRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Store-profile change request not found.",
      });
    }

    if (request.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "This request has already been reviewed.",
      });
    }

    const rejectedRequest = await StoreProfileChangeRequest.findOneAndUpdate(
      {
        _id: requestId,
        status: "pending",
      },
      {
        $set: {
          status: "rejected",
          reviewedBy: req.superAdmin._id,
          reviewedAt: new Date(),
          rejectionReason: reason || null,
        },
      },
      {
        new: true,
      },
    );

    if (!rejectedRequest) {
      return res.status(409).json({
        success: false,
        message: "This request has already been reviewed.",
      });
    }

    // If notification creation fails, restore the request to pending.
    try {
      await notifyShopOwner({
        storeId: request.storeId,
        requestId: request._id,
        type: "store_profile_rejected",
        title: "Store profile changes rejected",
        message: reason
          ? `Your store profile changes were rejected. Reason: ${reason}`
          : "Your store profile changes were rejected. Please review and submit again.",
      });
    } catch (notificationError) {
      await StoreProfileChangeRequest.updateOne(
        {
          _id: requestId,
          status: "rejected",
          reviewedBy: req.superAdmin._id,
        },
        {
          $set: {
            status: "pending",
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: null,
          },
        },
      );

      throw notificationError;
    }

    // The approved Store document is deliberately not modified.
    await deletePendingImages(request.proposedProfile);

    return res.status(200).json({
      success: true,
      message: "Store profile changes rejected successfully.",
      data: {
        requestId: rejectedRequest._id,
        status: rejectedRequest.status,
        rejectionReason: rejectedRequest.rejectionReason,
      },
    });
  } catch (error) {
    console.error("[Store Profile Review] Rejection failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to reject the store profile changes.",
    });
  }
};

module.exports = {
  getPendingStoreProfileRequests,
  getStoreProfileRequestById,
  approveStoreProfileRequest,
  rejectStoreProfileRequest,
  getPendingStoreProfileImage,
};
