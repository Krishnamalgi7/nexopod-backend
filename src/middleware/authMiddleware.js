
const jwt = require("jsonwebtoken");
const SuperAdmin = require("../models/SuperAdmin");

const superAdminVerify = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const superAdmin = await SuperAdmin.findById(decoded.userId).select(
            "_id name phone isStoreCreator"
        );

        if (!superAdmin) {
            return res.status(401).json({
                success: false,
                message: "Super Admin account not found.",
            });
        }

        req.superAdmin = superAdmin;

        next();
    } catch (error) {
        console.error("Authentication error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token.",
        });
    }
};

module.exports = superAdminVerify;
