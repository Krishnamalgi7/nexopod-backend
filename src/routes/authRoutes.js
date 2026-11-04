import express from "express";
import { register, login } from "../controllers/authController.js";
import validateRequest from "../middleware/validateRequest.js";
import {
    registerSchema,
    loginSchema,
} from "../validators/authValidator.js";

const router = express.Router();

// POST /api/auth/register
router.post("/register", validateRequest(registerSchema), register);

// POST /api/auth/login
router.post("/login", validateRequest(loginSchema), login);

export default router;