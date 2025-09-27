const ImageKit = require("imagekit");
const { v4: uuidv4 } = require("uuid");

let imagekit = null;

function getImageKit() {
    if (!imagekit) {
        if (
            !process.env.IMAGEKIT_PUBLIC_KEY ||
            !process.env.IMAGEKIT_PRIVATE_KEY ||
            !process.env.IMAGEKIT_URL_ENDPOINT
        ) {
            console.error("ImageKit Environment Variables:");
            console.error(
                "IMAGEKIT_PUBLIC_KEY:",
                process.env.IMAGEKIT_PUBLIC_KEY ? "EXISTS" : "MISSING"
            );
            console.error(
                "IMAGEKIT_PRIVATE_KEY:",
                process.env.IMAGEKIT_PRIVATE_KEY ? "EXISTS" : "MISSING"
            );
            console.error(
                "IMAGEKIT_URL_ENDPOINT:",
                process.env.IMAGEKIT_URL_ENDPOINT ? "EXISTS" : "MISSING"
            );
            throw new Error(
                "Missing ImageKit environment variables. Please check your .env file."
            );
        }

        imagekit = new ImageKit({
            publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
            privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
            urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
        });
    }
    return imagekit;
}

async function uploadFile({ fileBuffer, folder = "/products" }) {
    const imagekitInstance = getImageKit();

    const resp = await imagekitInstance.upload({
        file: fileBuffer,
        fileName: uuidv4(),
        folder,
    });

    return {
        url: resp.url,
        thumbnail: resp.thumbnailUrl || resp.url,
        id: resp.fileId,
    };
}

module.exports = { uploadFile };
