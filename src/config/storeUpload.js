
const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
        console.error("Invalid store image type:", file.mimetype);

        return callback(
            new Error("Only JPG, PNG and WEBP images are allowed.")
        );
    }

    callback(null, true);
};

const storeUpload = multer({
    storage,
    fileFilter,
    limits: {
        files: 5,
        fileSize: 5 * 1024 * 1024, // 5 MB per image
    },
});

module.exports = storeUpload;
