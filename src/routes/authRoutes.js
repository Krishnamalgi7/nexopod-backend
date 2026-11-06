import express from "express";
import { register, login } from "../controllers/authController.js";
import validateRequest from "../middleware/validateRequest.js";
import {
    registerSchema,
    loginSchema,
} from "../validators/authValidator.js";
import {
    checkRegistrationStatus,
} from "../controllers/registrationStatusController.js";

const router = express.Router();

// GET /api/auth/registration-status
router.get("/registration-status", checkRegistrationStatus);

// POST /api/auth/register
router.post("/register", validateRequest(registerSchema), register);

// POST /api/auth/login
router.post("/login", validateRequest(loginSchema), login);

export default router;