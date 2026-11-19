
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    type: {
      type: String,
      enum: ["new_booking", "booking_completed"],
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
    collection: "Notifications",
  }
);

notificationSchema.index({ storeId: 1, createdAt: -1 });
notificationSchema.index({ storeId: 1, isRead: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
