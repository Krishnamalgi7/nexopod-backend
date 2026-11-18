
const express = require("express");

const {
    registerSuperAdmin,
    loginSuperAdmin,
    getRegistrationStatus
} = require("../controllers/authController");

const { adminLoginLimiter } = require("../middleware/otpRateLimit");

const router = express.Router();

router.get("/registration-status", getRegistrationStatus);
router.post("/register", registerSuperAdmin);
router.post("/login", adminLoginLimiter, loginSuperAdmin);

module.exports = router;
