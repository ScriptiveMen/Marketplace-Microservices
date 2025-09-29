const cartModel = require("../model/cart.model");

async function getCart(req, res) {
    try {
        const user = req.user;
        const cart = await cartModel.findOne({ user: user._id });

        if (!cart) {
            const newCart = new cartModel({ user: user._id, items: [] });
            await newCart.save();

            return res.status(200).json({
                cart: newCart,
                totals: {
                    itemCount: 0,
                    totalQuantity: 0,
                },
            });
        }

        res.status(200).json({
            cart,
            totals: {
                itemCount: cart.items.length,
                totalQuantity: cart.items.reduce(
                    (sum, item) => sum + item.quantity,
                    0 // Added initial value
                ),
            },
        });
    } catch (error) {
        res.status(500).json({
            message: "Server error",
        });
    }
}

async function addItemToCart(req, res) {
    const { productId, qty } = req.body;

    const user = req.user;

    let cart = await cartModel.findOne({ user: user._id });

    if (!cart) {
        cart = new cartModel({ user: user._id, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
    );

    if (existingItemIndex !== -1) {
        cart.items[existingItemIndex].quantity += qty;
    } else {
        cart.items.push({ productId, quantity: qty });
    }

    await cart.save();
    res.status(200).json({
        message: "Item added to cart",
        cart,
    });
}

async function updateItemQuantity(req, res) {
    try {
        const { productId } = req.params;
        const { qty } = req.body;
        const user = req.user;

        const cart = await cartModel.findOne({ user: user._id });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const itemIndex = cart.items.findIndex(
            (item) => item.productId.toString() === productId
        );

        if (itemIndex === -1) {
            return res
                .status(404)
                .json({ message: "Product not found in cart" });
        }

        cart.items[itemIndex].quantity = qty;
        await cart.save();

        res.status(200).json({ message: "Cart item updated", cart });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
}

module.exports = { addItemToCart, updateItemQuantity, getCart };
