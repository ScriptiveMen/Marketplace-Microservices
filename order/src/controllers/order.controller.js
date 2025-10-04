const orderModel = require("../models/order.model");
const axios = require("axios");
const { publishToQueue } = require("../broker/broker");

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

        await publishToQueue("ORDER_SELLER_DASHBOARD.ORDER_CREATED", order);

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

async function getMyOrders(req, res) {
    const user = req.user;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    try {
        const orders = await orderModel
            .find({ user: user.id })
            .skip(skip)
            .limit(limit);

        const totalOrders = await orderModel.countDocuments({ user: user.id });

        res.status(200).json({
            orders,
            total: totalOrders,
            page,
            limit,
        });
    } catch (error) {
        res.status(500).json({
            message: "Internal server error",
            error: error.message,
        });
    }
}

async function getOrderById(req, res) {
    const user = req.user;

    const orderId = req.params.id;

    try {
        const order = await orderModel.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (order.user.toString() !== user.id) {
            return res.status(403).json({
                message: "Forbidden: You do not have access to this order",
            });
        }

        res.status(200).json({ order });
    } catch (err) {
        res.status(500).json({
            message: "Internal server error",
            error: err.message,
        });
    }
}

async function cancelOrderById(req, res) {
    const user = req.user;
    const cancelId = req.params.id;

    try {
        const order = await orderModel.findById(cancelId);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (order.user.toString() !== user.id) {
            return res.status(403).json({
                message: "Forbidden: You do not have access to this order ",
            });
        }

        if (order.status != "PENDING") {
            return res.status(409).json({
                message: "Your order cannot be cancelled at this stage",
            });
        }

        order.status = "CANCELLED";
        await order.save();

        res.status(200).json({ order });
    } catch (error) {
        res.status(500).json({
            message: "Internal server error",
            error: error.message,
        });
    }
}

async function updateOrderAddress(req, res) {
    const user = req.user;

    const orderId = req.params.id;

    try {
        const order = await orderModel.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (order.user.toString() !== user.id) {
            return res.status(409).json({
                message: "Forbidden: You do not have access to this order",
            });
        }

        // only PENDING orders can have address updated
        if (order.status !== "PENDING") {
            return res.status(409).json({
                message: "Order address cannot be updated at this stage",
            });
        }

        order.shippingAddress = {
            street: req.body.shippingAddress.street,
            pincode: req.body.shippingAddress.pincode,
            city: req.body.shippingAddress.city,
            country: req.body.shippingAddress.country,
            state: req.body.shippingAddress.state,
        };

        await order.save();

        res.status(200).json({ order });
    } catch (error) {
        res.status(500).json({
            message: "Internal server error",
            error: error.message,
        });
    }
}

module.exports = {
    createOrder,
    getMyOrders,
    getOrderById,
    cancelOrderById,
    updateOrderAddress,
};
