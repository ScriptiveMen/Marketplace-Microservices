const productModel = require("../models/product.model");
const { uploadImage } = require("../services/imagekit.service");

async function createProduct(req, res) {
    try {
        const {
            title,
            description,
            priceAmount,
            priceCurrency = "INR",
        } = req.body;

        const seller = req.user.id;

        const price = {
            amount: Number(priceAmount),
            currency: priceCurrency,
        };

        if (!title || !priceAmount) {
            return res
                .status(400)
                .json({ message: "title and priceAmount are required" });
        }

        const images = await Promise.all(
            (req.files || []).map((file) =>
                uploadImage({ buffer: file.buffer })
            )
        );

        const product = await productModel.create({
            title,
            description,
            price,
            seller,
            images: images,
        });

        res.status(201).json({
            message: "Product Created",
            data: product,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "internal error" });
    }
}

module.exports = {
    createProduct,
};
