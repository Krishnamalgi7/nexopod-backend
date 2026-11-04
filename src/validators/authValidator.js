import { z } from "zod";

// Registration validation
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),

  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Phone number must contain exactly 10 digits"),

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(72, "Password cannot exceed 72 characters"),
});

// Login validation
export const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Phone number must contain exactly 10 digits"),

  password: z
    .string()
    .min(1, "Password is required")
    .max(72, "Invalid password"),
});
