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
    .refine((value) => {
      try {
        const url = new URL(value);

        const hostname = url.hostname.toLowerCase();

        const isGoogleMapsDomain =
          hostname === "maps.app.goo.gl" ||
          hostname === "goo.gl" ||
          hostname === "maps.google.com" ||
          hostname === "google.com" ||
          hostname.endsWith(".google.com") ||
          hostname === "google.co.in" ||
          hostname.endsWith(".google.co.in");

        return ["http:", "https:"].includes(url.protocol) && isGoogleMapsDomain;
      } catch {
        return false;
      }
    }, "Please provide a valid Google Maps link"),

  contactNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Contact number must contain exactly 10 digits"),
});
