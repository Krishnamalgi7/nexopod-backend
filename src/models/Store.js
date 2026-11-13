const mongoose = require("mongoose");

const storeImageSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["upload"],
      required: true,
    },
    path: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const dayTimingSchema = new mongoose.Schema(
  {
    isClosed: {
      type: Boolean,
      default: false,
    },

    openTime: {
      type: String,
      trim: true,
      match: /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/,
    },

    closeTime: {
      type: String,
      trim: true,
      match: /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/,
    },
  },
  { _id: false },
);

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    addressLink: {
      type: String,
      required: true,
      trim: true,
    },

    contactNumber: {
      type: String,
      required: true,
      match: /^[0-9]{10}$/,
    },

    timings: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    services: {
      type: [String],
      enum: ["Phone Charging", "Pick Me Later"],
      default: [],
    },

    weeklyTimings: {
      monday: {
        type: dayTimingSchema,
        default: undefined,
      },
      tuesday: {
        type: dayTimingSchema,
        default: undefined,
      },
      wednesday: {
        type: dayTimingSchema,
        default: undefined,
      },
      thursday: {
        type: dayTimingSchema,
        default: undefined,
      },
      friday: {
        type: dayTimingSchema,
        default: undefined,
      },
      saturday: {
        type: dayTimingSchema,
        default: undefined,
      },
      sunday: {
        type: dayTimingSchema,
        default: undefined,
      },
    },

    image: {
      type: storeImageSchema,
      required: true,
    },

    images: {
      type: [storeImageSchema],
      default: [],
      validate: {
        validator: (images) => images.length <= 4,
        message: "A maximum of 4 additional images is allowed.",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "All_Stores",
  },
);

// Indexes for filtering, sorting and searching.
storeSchema.index({ isActive: 1, createdAt: -1 });
storeSchema.index({ name: 1 });
storeSchema.index({ contactNumber: 1 });

const Store = mongoose.model("Store", storeSchema);

module.exports = Store;
