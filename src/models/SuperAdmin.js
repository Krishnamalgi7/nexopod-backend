
const mongoose = require("mongoose");

const superAdminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
        },

        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
            select: false,
        },

        isStoreCreator: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        collection: "Super_Admin",
    }
);

// Only one account can have Store Creator permission.
superAdminSchema.index(
    { isStoreCreator: 1 },
    {
        unique: true,
        partialFilterExpression: {
            isStoreCreator: true,
        },
    }
);

const SuperAdmin = mongoose.model("SuperAdmin", superAdminSchema);

module.exports = SuperAdmin;
