import bcrypt from "bcrypt";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

export const registerUser = async ({ name, phone, password }) => {
    try {
        // Check whether phone number already exists
        const existingUser = await User.findOne({ phone });

        if (existingUser) {
            const error = new Error("Phone number is already registered");
            error.statusCode = 409;
            throw error;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create new user
        const user = await User.create({
            name,
            phone,
            password: hashedPassword,
        });

        // Return safe user information
        return {
            id: user._id,
            name: user.name,
            phone: user.phone,
            createdAt: user.createdAt,
        };

    } catch (error) {

        // Handle duplicate key error (concurrent registrations)
        if (error.code === 11000) {
            const duplicateError = new Error(
                "Phone number is already registered"
            );

            duplicateError.statusCode = 409;
            throw duplicateError;
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