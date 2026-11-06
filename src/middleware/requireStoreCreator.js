
const requireStoreCreator = (req, res, next) => {
    try {
        // authenticateUser must run before this middleware.
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        // Only the Store Creator can create stores.
        if (!req.user.isStoreCreator) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to create stores.",
            });
        }

        next();
    } catch (error) {
        console.error(
            "Store Creator authorization error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to verify store creation permission.",
        });
    }
};

export default requireStoreCreator;
