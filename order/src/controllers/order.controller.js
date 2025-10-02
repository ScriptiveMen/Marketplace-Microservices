const orderModel = require("../models/order.model");
const axios = require("axios");

async function createOrder(req, res) {
    const user = req.user;
    const token =
        req.cookies?.token || req.headers?.authorization?.split(" ")[1];

    try {
        const cartResponse = await axios.get("http://localhost:3002/api/cart", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        // Fetch cart data from cart service

        const products = await Promise.all(
            cartResponse.data.cart.items.map(async (item) => {
                return (
                    await axios.get(
                        `http://localhost:3001/api/products/${item.productId} `,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        }
                    )
                ).data.product;
            })
        );

        let priceAmount = 0;

        const orderItems = cartResponse.data.cart.items.map((item, index) => {
            const product = products.find((p) => p._id === item.productId);

            // if not in stock, doesn't allow order creation
            if (product.stock < item.quantity) {
                throw new Error(`Product ${product.title} is out of stock`);
            }

            // calculating total price
            const itemTotal = product.price.amount * item.quantity;
            priceAmount += itemTotal;

            return {
                product: item.productId,
                quantity: item.quantity,
                price: {
                    amount: itemTotal,
                    currency: product.price.currency,
                },
            };
        });

        const order = await orderModel.create({
            user: user.id,
            items: orderItems,
            status: "PENDING",
            totalPrice: {
                amount: priceAmount,
                currency: "INR",
            },
            shippingAddress: req.body.shippingAddress,
        });

        res.status(201).json({
            message: "Order placed",
            order,
        });
    } catch (error) {
        res.status(500).json({
            message: "Internal Server Error",
            error: error.message,
        });
    }
}

module.exports = { createOrder };
