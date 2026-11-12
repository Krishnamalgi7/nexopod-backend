
const express = require("express");

const {
    registerSuperAdmin,
    loginSuperAdmin,
    getRegistrationStatus
} = require("../controllers/authController");

const router = express.Router();

router.get("/registration-status", getRegistrationStatus);
router.post("/register", registerSuperAdmin);
router.post("/login", loginSuperAdmin);

module.exports = router;
