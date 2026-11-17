
const express = require("express");

const {
    getPublicStores,
    getPublicStoreById,
} = require("../controllers/publicStoreController");

const {
    getPhoneChargingAvailability,
    getPickMeLaterAvailability,
} = require("../controllers/bookingController");

const router = express.Router();

// Get active stores for the Customer app.
router.get("/", getPublicStores);

// Get public details of a single Store.
router.get("/:storeId", getPublicStoreById);

// Get booked Phone Charging times for a selected date.
router.get(
    "/:storeId/phone-charging/availability",
    getPhoneChargingAvailability
);

// Get booked Pick Me Later times for a selected date.
router.get(
    "/:storeId/pick-me-later/availability",
    getPickMeLaterAvailability
);
module.exports = router;
