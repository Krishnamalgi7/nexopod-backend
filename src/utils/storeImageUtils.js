
const path = require("path");

// Resolve a stored store-image path safely.
const getStoreImageFilePath = (image, uploadRoot) => {
    if (
        !image ||
        image.type !== "upload" ||
        typeof image.path !== "string"
    ) {
        return null;
    }

    const prefix = "/uploads/stores/";

    if (!image.path.startsWith(prefix)) {
        return null;
    }

    const relativePath = image.path.slice(prefix.length);
    const absolutePath = path.resolve(uploadRoot, relativePath);

    if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
        return null;
    }

    return absolutePath;
};

module.exports = {
    getStoreImageFilePath,
};
