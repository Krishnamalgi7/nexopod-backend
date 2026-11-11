
import storeUpload from "../config/storeUpload.js";

const uploadFields = storeUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 4 },
]);

// Verify the actual file signature, not just its extension or MIME type.
const detectImageType = (buffer) => {
    // JPEG
    if (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    ) {
        return "image/jpeg";
    }

    // PNG
    if (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
            Buffer.from([
                0x89, 0x50, 0x4e, 0x47,
                0x0d, 0x0a, 0x1a, 0x0a,
            ])
        )
    ) {
        return "image/png";
    }

    // WEBP
    if (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
        return "image/webp";
    }

    return null;
};

const validateStoreImageFiles = (req, res, next) => {
    const files = [
        ...(req.files?.image || []),
        ...(req.files?.images || []),
    ];

    for (const file of files) {
        const detectedType = detectImageType(file.buffer);

        console.log("STORE IMAGE DEBUG:", {
    field: file.fieldname,
    originalName: file.originalname,
    mimetype: file.mimetype,
    detectedType,
    bufferLength: file.buffer?.length,
    signature: file.buffer?.subarray(0, 16).toString("hex"),
});

        if (!detectedType) {
            console.error("Store image verification failed:", {
                field: file.fieldname,
                mimetype: file.mimetype,
            });

            return res.status(400).json({
                success: false,
                message: "One or more uploaded files are not valid images.",
            });
        }
    }

    next();
};

const uploadStoreImages = (req, res, next) => {
    uploadFields(req, res, (error) => {
        if (error) {
            console.error("Store image upload error:", error.message);

            return res.status(400).json({
                success: false,
                message: error.message || "Store image upload failed.",
            });
        }

        validateStoreImageFiles(req, res, next);
    });
};

export default uploadStoreImages;
