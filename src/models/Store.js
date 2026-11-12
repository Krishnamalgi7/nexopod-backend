
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
    { _id: false }
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
    }
);

// Indexes for filtering, sorting and searching.
storeSchema.index({ isActive: 1, createdAt: -1 });
storeSchema.index({ name: 1 });
storeSchema.index({ contactNumber: 1 });

const Store = mongoose.model("Store", storeSchema);

module.exports = Store;
