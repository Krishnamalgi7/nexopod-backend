
const express = require("express");

const {
    sendCustomerOtp,
    loginCustomer,
    getCustomerProfile,
    updateCustomerProfile,
} = require("../controllers/customerController");

const {
    getCustomerBookings,
} = require("../controllers/bookingController");

const customerVerify = require("../middleware/customerVerify");

const router = express.Router();

// 1. Send OTP to the Customer.
router.post("/send-otp", sendCustomerOtp);

// 2. Login or register the Customer using OTP.
router.post("/login", loginCustomer);

// 3. Fetch the authenticated Customer's profile.
router.get("/me", customerVerify, getCustomerProfile);

// 4. Update the authenticated Customer's profile.
router.patch("/me", customerVerify, updateCustomerProfile);

// Get the authenticated Customer's booking history.
router.get("/bookings", customerVerify, getCustomerBookings);

module.exports = router;
