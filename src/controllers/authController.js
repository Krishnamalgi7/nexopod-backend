
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const SuperAdmin = require("../models/SuperAdmin");

// Register the first and only Super Admin
const registerSuperAdmin = async (req, res) => {
    try {
        const { name, phone, password } = req.body;

        // Validate request data
        if (!name || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, phone and password are required.",
            });
        }

        const trimmedName = name.trim();
        const trimmedPhone = phone.trim();

        if (trimmedName.length < 2 || trimmedName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Name must contain between 2 and 100 characters.",
            });
        }

        if (!/^[0-9]{10}$/.test(trimmedPhone)) {
            return res.status(400).json({
                success: false,
                message: "Phone number must contain exactly 10 digits.",
            });
        }

        if (typeof password !== "string" || password.length < 8 || password.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Password must contain between 8 and 72 characters.",
            });
        }

        // Ensure database indexes exist
        await SuperAdmin.init();

        // Check existing accounts
        const existingAdminsCount = await SuperAdmin.countDocuments();

        if (existingAdminsCount > 1) {
            return res.status(500).json({
                success: false,
                message: "Multiple accounts already exist. Please contact the administrator.",
            });
        }

        if (existingAdminsCount === 1) {
            const existingAdmin = await SuperAdmin.findOne();

            if (!existingAdmin.isStoreCreator) {
                await SuperAdmin.updateOne(
                    { _id: existingAdmin._id },
                    { $set: { isStoreCreator: true } }
                );
            }

            return res.status(403).json({
                success: false,
                message: "Super Admin already exists. New registrations are closed.",
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create Super Admin
        const superAdmin = await SuperAdmin.create({
            name: trimmedName,
            phone: trimmedPhone,
            password: hashedPassword,
            isStoreCreator: true,
        });

        return res.status(201).json({
            success: true,
            message: "Super Admin registration successful.",
            data: {
                id: superAdmin._id,
                name: superAdmin.name,
                phone: superAdmin.phone,
                isStoreCreator: superAdmin.isStoreCreator,
                createdAt: superAdmin.createdAt,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            if (
                error.keyPattern?.isStoreCreator === 1 ||
                error.keyValue?.isStoreCreator === true
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Super Admin already exists. New registrations are closed.",
                });
            }

            if (error.keyPattern?.phone === 1) {
                return res.status(409).json({
                    success: false,
                    message: "Phone number is already registered.",
                });
            }
        }

        console.error("Super Admin registration error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong during Super Admin registration.",
        });
    }
};


// Login Super Admin
const loginSuperAdmin = async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Phone number and password are required.",
            });
        }

        if (!/^[0-9]{10}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Phone number must contain exactly 10 digits.",
            });
        }

        if (typeof password !== "string" || password.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Invalid password.",
            });
        }

        const superAdmin = await SuperAdmin.findOne({
            phone,
        }).select("+password");

        if (!superAdmin) {
            return res.status(401).json({
                success: false,
                message: "Invalid phone number or password.",
            });
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            superAdmin.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid phone number or password.",
            });
        }

        const token = jwt.sign(
            { userId: superAdmin._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            data: {
                token,
                user: {
                    id: superAdmin._id,
                    name: superAdmin.name,
                    phone: superAdmin.phone,
                },
            },
        });
    } catch (error) {
        console.error("Super Admin login error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong during login.",
        });
    }
};


// Check whether Super Admin registration is available
const getRegistrationStatus = async (req, res) => {
    try {
        const existingAdminsCount = await SuperAdmin.countDocuments();

        return res.status(200).json({
            success: true,
            data: {
                registrationOpen: existingAdminsCount === 0,
            },
        });
    } catch (error) {
        console.error("Registration status error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to check registration status.",
        });
    }
};

module.exports = {
    registerSuperAdmin,
    loginSuperAdmin,
    getRegistrationStatus
};
