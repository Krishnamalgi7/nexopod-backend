
const mongoose = require("mongoose");

const storeProfileChangeRequestSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true, 
    },

    // Complete proposed Store profile.
    proposedProfile: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "Store_Profile_Change_Requests",
  },
);

// Only one pending request per store.
storeProfileChangeRequestSchema.index(
  { storeId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "pending",
    },
  },
);

storeProfileChangeRequestSchema.index({
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "StoreProfileChangeRequest",
  storeProfileChangeRequestSchema,
);
