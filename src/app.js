
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const storeRoutes = require("./routes/storeRoutes");
const shopOwnerAuthRoutes = require("./routes/shopOwnerRoutes");
const customerRoutes = require("./routes/customerRoutes");
const publicStoreRoutes = require("./routes/publicStoreRoutes");
const bookingRoutes = require("./routes/bookingRoutes");

const app = express();

// CORS configuration
app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:3000",
    })
);

// Parse incoming JSON requests
app.use(express.json({ limit: "10kb" }));

// Authentication APIs
app.use("/api/auth", authRoutes);

// Store APIs
app.use("/api/stores", storeRoutes);

// Serve uploaded store images
app.use(
    "/uploads",
    express.static(path.resolve("uploads"))
);

app.use("/api/shop-owners", shopOwnerAuthRoutes);

app.use("/api/customers", customerRoutes);

app.use("/api/public/stores", publicStoreRoutes);

app.use("/api/bookings", bookingRoutes);

// Health check API
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "nexopod API is running",
    });
});

module.exports = app;
