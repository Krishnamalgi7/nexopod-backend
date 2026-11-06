import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
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
    }
);

// Only one user can have Store Creator permission.
userSchema.index(
    { isStoreCreator: 1 },
    {
        unique: true,
        partialFilterExpression: {
            isStoreCreator: true,
        },
    }
);

const User = mongoose.model("User", userSchema);

export default User;