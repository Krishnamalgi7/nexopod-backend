
import { z } from "zod";

export const createStoreSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Store name must contain at least 2 characters")
        .max(100, "Store name cannot exceed 100 characters"),

    addressLink: z
        .string()
        .trim()
        .url("Please enter a valid Google Maps link")
        .refine(
            (value) => {
                try {
                    const url = new URL(value);

                    return ["http:", "https:"].includes(url.protocol);
                } catch {
                    return false;
                }
            },
            "Address link must use HTTP or HTTPS"
        ),

    contactNumber: z
        .string()
        .trim()
        .regex(
            /^[0-9]{10}$/,
            "Contact number must contain exactly 10 digits"
        ),
});
