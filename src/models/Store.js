
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
    },
    {
        timestamps: true,
    }
);

const Store = mongoose.model("Store", storeSchema);

export default Store;
