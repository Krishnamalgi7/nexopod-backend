import bcrypt from "bcrypt";
import User from "../models/User.js";
import jwt from "jsonwebtoken";


export const registerUser = async ({ name, phone, password }) => {
    try {
        // Ensure MongoDB indexes are created before registration.
        await User.init();

        // Check how many accounts already exist.
        const existingUsersCount = await User.countDocuments();

        // Fail safely if multiple legacy accounts already exist.
        if (existingUsersCount > 1) {
            const error = new Error(
                "Multiple accounts already exist. Please contact the administrator."
            );
            error.statusCode = 500;
            throw error;
        }

        // If one account exists, it is the holder.
        if (existingUsersCount === 1) {
            const existingUser = await User.findOne();

            // Promote the existing account to Store Creator.
            if (!existingUser.isStoreCreator) {
                await User.updateOne(
                    { _id: existingUser._id },
                    { $set: { isStoreCreator: true } }
                );
            }

            const error = new Error(
                "Holder already exists. New registrations are closed."
            );
            error.statusCode = 403;
            throw error;
        }

        // Hash password before saving.
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create the only permitted account.
        const user = await User.create({
            name,
            phone,
            password: hashedPassword,
            isStoreCreator: true,
        });

        console.log("NexoPod holder account registered:", user._id);

        return {
            id: user._id,
            name: user.name,
            phone: user.phone,
            isStoreCreator: user.isStoreCreator,
            createdAt: user.createdAt,
        };

    } catch (error) {
        // Handle duplicate-key errors.
        if (error.code === 11000) {
            if (
                error.keyPattern?.isStoreCreator === 1 ||
                error.keyValue?.isStoreCreator === true
            ) {
                const holderError = new Error(
                    "Holder already exists. New registrations are closed."
                );
                holderError.statusCode = 403;
                throw holderError;
            }

            if (error.keyPattern?.phone === 1) {
                const duplicateError = new Error(
                    "Phone number is already registered."
                );
                duplicateError.statusCode = 409;
                throw duplicateError;
            }
        }

        throw error;
    }
};


export const loginUser = async ({ phone, password }) => {
    // Find user and explicitly include the password field
    const user = await User.findOne({ phone }).select("+password");

    // Use the same error for unknown phone and incorrect password
    if (!user) {
        const error = new Error("Invalid phone number or password");
        error.statusCode = 401;
        throw error;
    }

    // Compare entered password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        const error = new Error("Invalid phone number or password");
        error.statusCode = 401;
        throw error;
    }

    // Generate JWT token
    const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    // Return token and safe user information
    return {
        token,
        user: {
            id: user._id,
            name: user.name,
            phone: user.phone,
        },
    };
};


export const getRegistrationStatus = async () => {
    try {
        const existingUsersCount = await User.countDocuments();

        return {
            registrationOpen: existingUsersCount === 0,
        };
    } catch (error) {
        console.error("Registration status check failed:", error.message);
        throw error;
    }
};
