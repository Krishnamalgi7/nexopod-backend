import express from "express";
import cors from "cors";
import path from "node:path";
import authRoutes from "./routes/authRoutes.js";
import storeRoutes from "./routes/storeRoutes.js";

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

// Health check API
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "nexopod API is running",
    });
});

export default app;