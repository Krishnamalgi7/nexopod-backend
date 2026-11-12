import mongoose from "mongoose";

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

    // Store operating timings (e.g., "10:00 AM - 09:00 PM")
    timings: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    // Main store image
    image: {
      type: storeImageSchema,
      required: true,
    },

    // Maximum 4 additional images
    images: {
      type: [storeImageSchema],
      default: [],
      validate: {
        validator: (images) => images.length <= 4,
        message: "A maximum of 4 additional images is allowed.",
      },
    },

    // Store operational status (true = Active, false = Inactive)
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for fast filtering, sorting, and searching in MongoDB
storeSchema.index({ isActive: 1, createdAt: -1 });
storeSchema.index({ name: 1 });
storeSchema.index({ contactNumber: 1 });

const Store = mongoose.model("Store", storeSchema);

export default Store;
