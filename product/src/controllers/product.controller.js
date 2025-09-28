const { default: mongoose } = require("mongoose");
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

async function getProducts(req, res) {
    const { q, minprice, maxprice, skip = 0, limit = 20 } = req.query;

    const filter = {};

    if (q) {
        filter.$text = { $search: q };
    }

    if (minprice) {
        filter["price.amount"] = {
            ...filter["price.amount"],
            $gte: Number(minprice),
        };
    }

    if (maxprice) {
        filter["price.amount"] = {
            ...filter["price.amount"],
            $lte: Number(maxprice),
        };
    }

    const products = await productModel
        .find(filter)
        .skip(Number(skip))
        .limit(Math.min(Number(limit), 20));

    res.status(200).json({
        data: products,
    });
}

async function getProductById(req, res) {
    const { id } = req.params;

    if (!id) {
        return res.status(404).json({ message: "Product Id not found " });
    }

    const product = await productModel.findById(id);

    if (!product) {
        return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ product });
}

async function updateProduct(req, res) {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await productModel.findOne({
        _id: id,
    });

    if (!product) {
        return res.status(404).json({ message: "Product not found" });
    }

    if (product.seller.toString() !== req.user.id) {
        return res.status(403).json({
            message: "Forbidden: You cannot update another seller's product",
        });
    }

    const allowedUpdates = ["title", "description", "price"];
    for (const key of Object.keys(req.body)) {
        if (allowedUpdates.includes(key)) {
            if (key === "price" && typeof req.body.price === "object") {
                if (req.body.price.amount != undefined) {
                    product.price.amount = Number(req.body.price.amount);
                }

                if (req.body.price.currency != undefined) {
                    product.price.currency = req.body.price.currency;
                }
            } else {
                product[key] = req.body[key];
            }
        }
    }

    await product.save();
    return res
        .status(200)
        .json({ message: "Product updated successfully", product });
}

async function deleteProduct(req, res) {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await productModel.findOne({
        _id: id,
    });

    if (!product) {
        return res.status(404).json({ message: "Product not found" });
    }

    if (product.seller.toString() !== req.user.id) {
        return res.status(403).json({
            message: "Forbidden: You cannot delete another seller's product",
        });
    }

    await productModel.findOneAndDelete({ _id: id });

    res.status(200).json({ message: "Product deleted successfully" });
}

async function getProductsBySeller(req, res) {
    const seller = req.user;

    const { skip = 0, limit = 20 } = req.query;

    try {
        const products = await productModel
            .find({
                seller: seller.id,
            })
            .skip(skip)
            .limit(Math.min(limit, 20));

        return res.status(200).json({
            data: products,
        });
    } catch (error) {
        return res.status(500).json({ message: "internal error" });
    }
}

module.exports = {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getProductsBySeller,
};
