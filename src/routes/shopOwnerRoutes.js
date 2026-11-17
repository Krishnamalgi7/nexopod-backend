
const express = require("express");

const {
    loginShopOwner,
    getShopOwnerDetails,
    sendShopOwnerOtp,
} = require("../controllers/shopOwnerController");

const {
    getShopOwnerBookings,
    updatePhoneChargingBookingStatus,
} = require("../controllers/bookingController");

const shopOwnerVerify = require("../middleware/shopOwnerVerify");
const router = express.Router();


router.post("/send-otp", sendShopOwnerOtp);

router.post("/login", loginShopOwner);

// Get authenticated Shop Owner's store details
router.get("/me", shopOwnerVerify, getShopOwnerDetails);

// Get bookings for the authenticated Shop Owner's store.
router.get("/bookings", shopOwnerVerify, getShopOwnerBookings);

// Update a Phone Charging booking's session status.
router.patch(
    "/bookings/:bookingId/status",
    shopOwnerVerify,
    updatePhoneChargingBookingStatus
);

module.exports = router;
