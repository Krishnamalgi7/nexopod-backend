
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Customer = require("../models/Customer");

const customerVerify = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Customer authentication required.",
            });
        }

        // 1. Verify the Customer authentication token.
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 2. Validate the Customer token details.
        if (
            decoded.role !== "customer" ||
            !mongoose.Types.ObjectId.isValid(decoded.customerId) ||
            typeof decoded.phone !== "string"
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid Customer token.",
            });
        }

        // 3. Confirm the Customer account still exists.
        const customer = await Customer.findOne({
            _id: decoded.customerId,
            phone: decoded.phone,
        }).select("_id phone name");

        if (!customer) {
            return res.status(401).json({
                success: false,
                message: "Customer account not found.",
            });
        }

        // 4. Attach the authenticated Customer to the request.
        req.customer = customer;

        next();
    } catch (error) {
        console.error("[Customer] Authentication error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired Customer session.",
        });
    }
};

module.exports = customerVerify;
