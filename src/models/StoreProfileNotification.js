
const mongoose = require("mongoose");

const storeProfileNotificationSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreProfileChangeRequest",
      required: true,
    },

    recipientRole: {
      type: String,
      enum: ["superAdmin", "shopOwner"],
      required: true,
    },

    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    type: {
      type: String,
      enum: [
        "store_profile_submitted",
        "store_profile_approved",
        "store_profile_rejected",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "Store_Profile_Notifications",
  },
);

storeProfileNotificationSchema.index({
  recipientRole: 1,
  recipientId: 1,
  createdAt: -1,
});

storeProfileNotificationSchema.index({
  storeId: 1,
  recipientRole: 1,
  createdAt: -1,
});

storeProfileNotificationSchema.index({
  recipientRole: 1,
  recipientId: 1,
  isRead: 1,
});

module.exports = mongoose.model(
  "StoreProfileNotification",
  storeProfileNotificationSchema,
);
