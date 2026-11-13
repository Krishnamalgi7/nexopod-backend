
const sharp = require("sharp");
const fs = require("fs/promises");

// Compress and save image as WebP.
const compressAndSaveImage = async (file, destination) => {
    const compressedBuffer = await sharp(file.buffer, {
        limitInputPixels: 40_000_000,
    })
        .rotate()
        .resize({
            width: 1600,
            height: 1200,
            fit: "inside",
            withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

    await fs.writeFile(destination, compressedBuffer);
};

module.exports = {
    compressAndSaveImage,
};
