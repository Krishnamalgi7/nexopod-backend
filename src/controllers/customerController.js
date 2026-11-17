
const jwt = require("jsonwebtoken");
const Customer = require("../models/Customer");

// 1. Store temporary development OTP sessions separately from Shop Owners.
const customerOtps = new Map();
const OTP_VALIDITY_MS = 2 * 60 * 1000;

// 2. Generate a development OTP for a Customer.
const sendCustomerOtp = async (req, res) => {
    try {
        const { phone } = req.body;

        if (
            typeof phone !== "string" ||
            !/^[0-9]{10}$/.test(phone.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit phone number.",
            });
        }

        // 3. Allow development OTP requests only in development mode.
        if (process.env.NODE_ENV !== "development") {
            return res.status(503).json({
                success: false,
                message: "Development OTP is not available.",
            });
        }

        // 4. Generate a fresh OTP session with a two-minute expiry.
        const customerPhone = phone.trim();
        const developmentOtp = process.env.CUSTOMER_DEV_OTP || "1234";

        if (!/^[0-9]{4}$/.test(developmentOtp)) {
            return res.status(500).json({
                success: false,
                message: "Development OTP configuration is invalid.",
            });
        }

        customerOtps.set(customerPhone, {
            otp: developmentOtp,
            expiresAt: Date.now() + OTP_VALIDITY_MS,
        });

        console.log("[Customer] Development OTP session created.");

        return res.status(200).json({
            success: true,
            message: "OTP generated successfully. It is valid for 2 minutes.",
            data: {
                expiresIn: 120,
                developmentOtp,
            },
        });
    } catch (error) {
        console.error("[Customer] OTP request failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to generate OTP. Please try again.",
        });
    }
};

// 5. Verify OTP and register or authenticate the Customer.
const loginCustomer = async (req, res) => {
    try {
        const { phone, otp } = req.body;

        if (
            typeof phone !== "string" ||
            typeof otp !== "string" ||
            !/^[0-9]{10}$/.test(phone.trim()) ||
            !/^[0-9]{4}$/.test(otp)
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit phone number and 4-digit OTP.",
            });
        }

        // 6. Restrict development OTP verification to development mode.
        if (process.env.NODE_ENV !== "development") {
            return res.status(503).json({
                success: false,
                message: "Development OTP login is not available.",
            });
        }

        const customerPhone = phone.trim();

        // 7. Retrieve the OTP session for this Customer.
        const otpSession = customerOtps.get(customerPhone);

        if (!otpSession) {
            return res.status(401).json({
                success: false,
                message: "Please request an OTP before logging in.",
            });
        }

        // 8. Reject and remove expired OTP sessions.
        if (Date.now() >= otpSession.expiresAt) {
            customerOtps.delete(customerPhone);

            return res.status(401).json({
                success: false,
                message: "OTP has expired. Please request a new OTP.",
            });
        }

        // 9. Verify the submitted OTP.
        if (otp !== otpSession.otp) {
            return res.status(401).json({
                success: false,
                message: "Invalid OTP.",
            });
        }

        // 10. Find an existing Customer or create a new account.
        let customer = await Customer.findOne({
            phone: customerPhone,
        });

        if (!customer) {
            try {
                customer = await Customer.create({
                    phone: customerPhone,
                });
            } catch (error) {
                // Handle simultaneous first-time registrations safely.
                if (error.code !== 11000) {
                    throw error;
                }

                customer = await Customer.findOne({
                    phone: customerPhone,
                });

                if (!customer) {
                    throw error;
                }
            }
        }

        // 11. Consume the OTP after successful verification.
        customerOtps.delete(customerPhone);

        // 12. Create a separate Customer authentication token.
        const token = jwt.sign(
            {
                role: "customer",
                customerId: customer._id.toString(),
                phone: customer.phone,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        console.log("[Customer] Login successful.");

        return res.status(200).json({
            success: true,
            message: "Customer login successful.",
            data: {
                token,
                customer: {
                    id: customer._id,
                    phone: customer.phone,
                    name: customer.name,
                },
            },
        });
    } catch (error) {
        console.error("[Customer] Login failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to complete Customer login.",
        });
    }
};


// 13. Get the authenticated Customer's profile.
const getCustomerProfile = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: "Customer profile fetched successfully.",
            data: {
                customer: {
                    id: req.customer._id,
                    phone: req.customer.phone,
                    name: req.customer.name,
                    createdAt: req.customer.createdAt,
                },
            },
        });
    } catch (error) {
        console.error("[Customer] Profile fetch failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch Customer profile.",
        });
    }
};

// 14. Update the authenticated Customer's profile.
const updateCustomerProfile = async (req, res) => {
    try {
        const { name } = req.body;

        if (
            typeof name !== "string" ||
            name.trim().length < 2 ||
            name.trim().length > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Name must contain between 2 and 100 characters.",
            });
        }

        // 15. Update the Customer name.
        req.customer.name = name.trim();
        await req.customer.save();

        console.log("[Customer] Profile updated successfully.");

        return res.status(200).json({
            success: true,
            message: "Customer profile updated successfully.",
            data: {
                customer: {
                    id: req.customer._id,
                    phone: req.customer.phone,
                    name: req.customer.name,
                    createdAt: req.customer.createdAt,
                },
            },
        });
    } catch (error) {
        console.error("[Customer] Profile update failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update Customer profile.",
        });
    }
};


// Export Customer authentication functions.
module.exports = {
    sendCustomerOtp,
    loginCustomer,
    getCustomerProfile,
    updateCustomerProfile,
};
