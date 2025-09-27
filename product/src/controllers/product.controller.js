const { uploadFile } = require("../services/imagekit.service");
const productModel = require("../models/product.model");

async function createProduct(req, res) {
    try {
        const {
            title,
            description,
            priceAmount,
            priceCurrency = "INR",
        } = req.body;

        // Fixed: Check for priceAmount instead of price
        if (!title || !priceAmount) {
            return res
                .status(400)
                .json({ message: "title and priceAmount are required" });
        }

        const seller = req.user.id;
        let images = [];

        // Fixed: Handle file uploads properly

        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map((file) =>
                uploadFile({ fileBuffer: file.buffer })
            );
            images = await Promise.all(uploadPromises);
        }

        const price = {
            amount: Number(priceAmount),
            currency: priceCurrency,
        };

        // Fixed: Use only the database model, remove in-memory array
        const product = await productModel.create({
            title,
            description,
            price,
            seller,
            images,
        });

        res.status(201).json(product);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "internal error" });
    }
}

module.exports = {
    createProduct,
};
