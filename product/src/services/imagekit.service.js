const ImageKit = require("imagekit");
const { v4: uuidv4 } = require("uuid");

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

async function uploadFile({ fileBuffer, folder = "/products" }) {
    const resp = await imagekit.upload({
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
