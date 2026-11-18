
const jwt = require("jsonwebtoken");
const Store = require("../models/Store");

// Store temporary development OTP sessions.
const shopOwnerOtps = new Map();
const OTP_VALIDITY_MS = 2 * 60 * 1000;

// Generate a development OTP for an authorized Shop Owner.
const sendShopOwnerOtp = async (req, res) => {
    try {
        const { phone } = req.body;

        if (typeof phone !== "string" || !/^[0-9]{10}$/.test(phone.trim())) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit phone number.",
            });
        }

        // 3. Allow fixed OTP requests only in development.
        if (process.env.NODE_ENV !== "development") {
            return res.status(503).json({
                success: false,
                message: "Development OTP is not available.",
            });
        }

        // 4. Confirm the number belongs to an active store.
        const store = await Store.findOne({
            contactNumber: phone.trim(),
            isActive: true,
        }).select("_id");

        if (!store) {
            return res.status(403).json({
                success: false,
                message: "This phone number is not authorized for an active store.",
            });
        }

        // 5. Create a fresh OTP session with a two-minute expiry.
        const developmentOtp = process.env.SHOP_OWNER_DEV_OTP || "1234";

        if (!/^[0-9]{4}$/.test(developmentOtp)) {
            return res.status(500).json({
                success: false,
                message: "Development OTP configuration is invalid.",
            });
        }

        shopOwnerOtps.set(phone.trim(), {
    otp: developmentOtp,
    expiresAt: Date.now() + OTP_VALIDITY_MS,
    attempts: 0,
});

        console.log("[ShopOwner] Development OTP session created.");

        return res.status(200).json({
            success: true,
            message: "OTP generated successfully. It is valid for 2 minutes.",
            data: {
                expiresIn: 120,
                
            },
        });
    } catch (error) {
        console.error("[ShopOwner] OTP request failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to generate OTP. Please try again.",
        });
    }
};

// Verify the OTP and authenticate the Shop Owner.
const loginShopOwner = async (req, res) => {
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

        // 7. Restrict development OTP verification to development mode.
        if (process.env.NODE_ENV !== "development") {
            return res.status(503).json({
                success: false,
                message: "Development OTP login is not available.",
            });
        }

        // 8. Retrieve the OTP session for this phone number.
        const otpSession = shopOwnerOtps.get(phone.trim());

        if (!otpSession) {
            return res.status(401).json({
                success: false,
                message: "Please request an OTP before logging in.",
            });
        }

        // 9. Reject and remove expired OTP sessions.
        if (Date.now() >= otpSession.expiresAt) {
            shopOwnerOtps.delete(phone.trim());

            return res.status(401).json({
                success: false,
                message: "OTP has expired. Please request a new OTP.",
            });
        }

        // 10. Verify the submitted OTP.
        if (otp !== otpSession.otp) {
    otpSession.attempts += 1;

    if (otpSession.attempts >= 5) {
        shopOwnerOtps.delete(phone.trim());

        return res.status(401).json({
            success: false,
            message: "Too many incorrect attempts. Please request a new OTP.",
        });
    }

    return res.status(401).json({
        success: false,
        message: "Invalid OTP.",
    });
}

        // 11. Confirm the phone still belongs to an active store.
        const store = await Store.findOne({
            contactNumber: phone.trim(),
            isActive: true,
        }).select("_id name contactNumber isActive");

        if (!store) {
            shopOwnerOtps.delete(phone.trim());

            return res.status(403).json({
                success: false,
                message: "This phone number is not authorized for an active store.",
            });
        }

        // 12. Consume the OTP after successful verification.
        shopOwnerOtps.delete(phone.trim());

        // 13. Create the Shop Owner authentication token.
        const token = jwt.sign(
            {
                role: "shopOwner",
                storeId: store._id.toString(),
                phone: store.contactNumber,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        console.log("[ShopOwner] Login successful.");

        return res.status(200).json({
            success: true,
            message: "Shop Owner login successful.",
            data: {
                token,
                store: {
                    id: store._id,
                    name: store.name,
                    contactNumber: store.contactNumber,
                },
            },
        });
    } catch (error) {
        console.error("[ShopOwner] Login failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to complete Shop Owner login.",
        });
    }
};

// Get the authenticated Shop Owner's store details.
const getShopOwnerDetails = async (req, res) => {
    try {
        // 1. Log the store details request.
        console.log("[ShopOwner] Fetching authenticated store details.");

        // 2. Fetch the store linked to the authenticated session.
        const store = await Store.findById(req.store._id)
            .select(
                "name addressLink contactNumber timings services weeklyTimings image images isActive createdAt"
            )
            .lean();

        // 3. Handle a store that no longer exists.
        if (!store) {
            console.warn("[ShopOwner] Store not found.");

            return res.status(404).json({
                success: false,
                message: "Store details not found.",
            });
        }

        // 4. Return the authenticated store details.
        console.log("[ShopOwner] Store details fetched successfully.");

        return res.status(200).json({
            success: true,
            message: "Store details fetched successfully.",
            data: {
                store,
            },
        });
    } catch (error) {
        console.error("[ShopOwner] Failed to fetch store details:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch store details.",
        });
    }
};

// Export Shop Owner controller functions.
module.exports = {
    loginShopOwner,
    getShopOwnerDetails,
    sendShopOwnerOtp,
};

