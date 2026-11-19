const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Store = require("../models/Store");

const shopOwnerVerify = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Shop Owner authentication required.",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure this is a Shop Owner token.
    if (
      decoded.role !== "shopOwner" ||
      !mongoose.Types.ObjectId.isValid(decoded.storeId)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid Shop Owner token.",
      });
    }

    // Verify the store is still active and the phone is still authorized.
    const store = await Store.findOne({
      _id: decoded.storeId,
      isActive: true,
    }).select("_id name contactNumber isActive");

    if (!store) {
      return res.status(403).json({
        success: false,
        message:
          "Store is inactive or Shop Owner access is no longer authorized.",
      });
    }

    req.store = store;

    next();
  } catch (error) {
    console.error("Shop Owner authentication error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired Shop Owner session.",
    });
  }
};

module.exports = shopOwnerVerify;
