
const createSlug = (name) => {
    return (
        name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 50) || "store"
    );
};

// Validate Google Maps URL.
const isValidGoogleMapsLink = (value) => {
    try {
        const url = new URL(value);
        const hostname = url.hostname.toLowerCase();

        const allowedDomains = [
            "maps.app.goo.gl",
            "goo.gl",
            "maps.google.com",
            "google.com",
            "google.co.in",
        ];

        const isGoogleMapsDomain = allowedDomains.some(
            (domain) =>
                hostname === domain ||
                hostname.endsWith("." + domain)
        );

        return (
            ["http:", "https:"].includes(url.protocol) &&
            isGoogleMapsDomain
        );
    } catch {
        return false;
    }
};

module.exports = {
    createSlug,
    isValidGoogleMapsLink,
};
