import {
    registerUser,
    loginUser,
} from "../services/authService.js";

// Register a new user
export const register = async (req, res) => {
    try {
        const user = await registerUser(req.body);

        return res.status(201).json({
            success: true,
            message: "Registration successful",
            data: user,
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Something went wrong during registration",
        });
    }
};

// Login an existing user
export const login = async (req, res) => {
    try {
        const result = await loginUser(req.body);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: result,
        });
    } catch (error) {
        console.error("LOGIN ERROR:", error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Something went wrong during login",
        });
    }
};