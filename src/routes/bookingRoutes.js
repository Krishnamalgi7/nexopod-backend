
const express = require("express");

const {
    createPhoneChargingBooking,
    createPickMeLaterBooking,
} = require("../controllers/bookingController");

const customerVerify = require("../middleware/customerVerify");

const router = express.Router();

// Create a Phone Charging booking.
router.post(
    "/phone-charging",
    customerVerify,
    createPhoneChargingBooking
);

// Create a Pick Me Later storage booking.
router.post(
    "/pick-me-later",
    customerVerify,
    createPickMeLaterBooking
);

module.exports = router;
