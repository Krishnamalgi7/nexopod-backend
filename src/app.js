import express from "express";
import cors from "cors";

const app = express();

// CORS configuration
app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:3000",
    })
);

// Parse incoming JSON requests
app.use(express.json({ limit: "10kb" }));

// Health check API
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "nexopod API is running",
    });
});

export default app;